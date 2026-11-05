"""Read-only image-rollout checks; --live explicitly collects Docker metadata without mutation."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


class RolloutError(RuntimeError):
    pass


def require(condition, reason):
    if not condition:
        raise RolloutError(reason)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def env_map(values):
    result = {}
    for value in values:
        key, item = value.split("=", 1) if "=" in value else (value, "")
        require(key not in result, "duplicate effective environment key")
        result[key] = item
    return result


# Only these upstream runtime version markers may change with the selected image.
# Application flags, PATH, mail settings and unknown inherited values remain frozen.
VERSION_ENV = frozenset({"NODE_VERSION", "YARN_VERSION", "NGINX_VERSION", "NJS_VERSION",
                         "NJS_RELEASE", "PKG_RELEASE", "DYNPKG_RELEASE"})


def effective_env(image, definition):
    declared = definition.get("environment") or {}
    require(isinstance(declared, dict) and all(value is not None for value in declared.values()),
            "resolved environment mapping required")
    return env_map(image["Config"].get("Env", [])) | {key: str(value) for key, value in declared.items()}


def stable_env(values, definition):
    declared = definition.get("environment") or {}
    return {key: value for key, value in values.items() if key not in VERSION_ENV or key in declared}


def target_fingerprint(container, definition, model):
    """Freeze all inspect configuration, with explicit recreate-only normalization."""
    config = copy.deepcopy(container["Config"])
    config["Env"] = stable_env(env_map(config.get("Env", [])), definition)
    # Image selection/provenance is checked separately against the immutable plan.
    config.pop("Image", None)
    identifier = container["Id"]
    if not definition.get("hostname") and config.get("Hostname") == identifier[:12]:
        config["Hostname"] = "<automatic-container-hostname>"
    labels = config.get("Labels") or {}
    for name in ("com.docker.compose.config-hash", "com.docker.compose.image",
                 "com.docker.compose.replace", "com.docker.compose.project.config_files"):
        labels.pop(name, None)
    config["Labels"] = labels
    network = copy.deepcopy(container.get("NetworkSettings", {}))
    for key in ("SandboxID", "SandboxKey"):
        network.pop(key, None)
    # Ports, gateway/prefixes, network IDs, driver options and static addressing stay.
    for name, endpoint in network.get("Networks", {}).items():
        endpoint.pop("EndpointID", None)
        logical = definition.get("networks") or {}
        options = next((value or {} for key, value in logical.items()
                        if model.get("networks", {}).get(key, {}).get("name", model["name"] + "_" + key) == name), {})
        # Full physical network names are already validated against Compose/policy.
        # Only allocator-generated addresses may differ on a new endpoint.
        if not options.get("ipv4_address"):
            endpoint.pop("IPAddress", None)
        if not options.get("ipv6_address"):
            endpoint.pop("GlobalIPv6Address", None)
        if not options.get("mac_address") and not definition.get("mac_address"):
            endpoint.pop("MacAddress", None)
        for key in ("Aliases", "DNSNames"):
            if endpoint.get(key) is not None:
                endpoint[key] = sorted("<automatic-container-id>" if item in (identifier, identifier[:12])
                                       else item for item in endpoint[key])
    return {"config": config, "host": container["HostConfig"],
            "networks": network, "mounts": container.get("Mounts", [])}


def raw_target(container):
    return digest({key: container.get(key) for key in ("Config", "HostConfig", "NetworkSettings", "Mounts")})


def bindings(values):
    return {key: sorted([[item["HostIp"], str(item["HostPort"])] for item in items])
            for key, items in (values or {}).items() if items}


def compose_ports(service):
    result = {}
    for port in service.get("ports", []):
        require(isinstance(port, dict), "resolved Compose port objects required")
        key = str(port["target"]) + "/" + port.get("protocol", "tcp")
        result.setdefault(key, []).append([port.get("host_ip", "0.0.0.0"), str(port["published"])])
    return {key: sorted(value) for key, value in result.items()}


def compose_mounts(config, service):
    result = []
    for mount in service.get("volumes", []):
        require(isinstance(mount, dict) and mount.get("source"), "resolved named/bind mounts required")
        source = mount["source"]
        if mount["type"] == "volume":
            source = config.get("volumes", {}).get(source, {}).get("name", config["name"] + "_" + source)
        result.append([mount["type"], source, mount["target"], bool(mount.get("read_only", False))])
    return sorted(result)


def actual_mounts(container):
    return sorted([[item["Type"], item.get("Name") if item["Type"] == "volume" else item["Source"],
                    item["Destination"], not item["RW"]] for item in container.get("Mounts", [])])


def hardening(config):
    return {"ReadonlyRootfs": bool(config.get("read_only", False)),
            "Privileged": bool(config.get("privileged", False)),
            "CapAdd": sorted(config.get("cap_add") or []), "CapDrop": sorted(config.get("cap_drop") or []),
            "SecurityOpt": sorted(config.get("security_opt") or []),
            "RestartPolicy": config.get("restart", "no"),
            "Memory": int(config.get("mem_limit") or 0), "PidsLimit": int(config.get("pids_limit") or 0)}


def runtime_hardening(container):
    config = container["HostConfig"]
    return {"ReadonlyRootfs": bool(config.get("ReadonlyRootfs", False)),
            "Privileged": bool(config.get("Privileged", False)),
            "CapAdd": sorted(config.get("CapAdd") or []), "CapDrop": sorted(config.get("CapDrop") or []),
            "SecurityOpt": sorted(config.get("SecurityOpt") or []),
            "RestartPolicy": config.get("RestartPolicy", {}).get("Name", "no"),
            "Memory": int(config.get("Memory") or 0), "PidsLimit": int(config.get("PidsLimit") or 0)}


def runtime_state(payload, policy, config, post=False, candidate_file=None):
    require(config.get("name") == policy["project"], "Compose project mismatch")
    require(set(config.get("services", {})) == set(policy["services"]), "Compose service set mismatch")
    require(not post or (candidate_file and Path(candidate_file).is_absolute()), "postcheck requires absolute candidate file")
    grouped = {}
    # Input MUST come from docker ps -aq, including stopped retained containers.
    for container in payload["containers"]:
        labels = container.get("Config", {}).get("Labels") or {}
        if labels.get("com.docker.compose.project") == policy["project"]:
            service = labels.get("com.docker.compose.service")
            require(service in policy["services"], "unexpected project service; stop for review")
            grouped.setdefault(service, []).append(container)
    images = {image["Id"]: image for image in payload["images"]}
    state, old_images = {}, {}
    for service, expected in policy["services"].items():
        matches = grouped.get(service, [])
        if service in policy["targets"]:
            require(len(matches) == 1, "missing or duplicate target containers; retained containers must not be removed")
            container = matches[0]
        else:
            active = [item for item in matches if item["State"]["Status"] == "running"]
            require(len(active) == 1, "exactly one running protected peer required")
            container = active[0]
        require(container.get("Name", "").lstrip("/") == expected["container"], "container name mismatch")
        require(container["State"]["Status"] == "running", "service is not running")
        health = container["State"].get("Health")
        require(not health or health.get("Status") == "healthy", "service is not healthy")
        labels = container["Config"]["Labels"]
        require(labels.get("com.docker.compose.project.working_dir") == policy["project_dir"], "Compose directory drift")
        files = [policy["config_file"]]
        if post and service in policy["targets"]:
            files.append(candidate_file)
        require(sorted(labels.get("com.docker.compose.project.config_files", "").split(",")) == sorted(files),
                "Compose file provenance drift")
        definition = config["services"][service]
        require(not definition.get("env_file"), "unresolved env_file; resolve privately without logging values")
        ports = bindings(container["HostConfig"].get("PortBindings"))
        require(ports == expected["ports"] == compose_ports(definition), "published port or loopback drift")
        networks = sorted(container.get("NetworkSettings", {}).get("Networks", {}))
        logical = definition.get("networks") or {"default": None}
        declared = sorted(config.get("networks", {}).get(name, {}).get("name", config["name"] + "_" + name)
                          for name in logical)
        require(networks == sorted(expected["networks"]) == declared, "network drift")
        mounts = actual_mounts(container)
        require(mounts == compose_mounts(config, definition), "mount drift")
        security = runtime_hardening(container)
        require(security == hardening(definition), "runtime hardening drift")
        declared_env = definition.get("environment") or {}
        require(isinstance(declared_env, dict) and all(value is not None for value in declared_env.values()),
                "resolved environment mapping required")
        actual_env = env_map(container["Config"].get("Env", []))
        require(all(actual_env.get(key) == str(value) for key, value in declared_env.items()), "environment drift")
        image = images.get(container["Image"])
        require(image is not None and "Config" in image, "current image metadata including defaults required")
        require(actual_env == effective_env(image, definition), "effective runtime environment mismatch")
        if service in policy["targets"]:
            for key, attribute in (("User", "user"), ("Cmd", "command"),
                                   ("Entrypoint", "entrypoint"), ("WorkingDir", "working_dir")):
                expected_process = definition.get(attribute)
                if expected_process is None:
                    expected_process = image["Config"].get(key)
                elif key in ("Cmd", "Entrypoint"):
                    require(isinstance(expected_process, list), "resolved process array required")
                else:
                    expected_process = str(expected_process)
                require(container["Config"].get(key) == expected_process, "unreproducible runtime process override")
        entry = {"ports": ports, "networks": networks, "mounts": mounts, "hardening": security,
                 "environment": declared_env}
        if service in policy["targets"]:
            entry["complete_target"] = target_fingerprint(container, definition, config)
        if service not in policy["targets"]:
            entry.update(container_id=container["Id"], image_id=container["Image"])
            entry["all_peers"] = sorted([{
                "id": peer["Id"], "image": peer["Image"], "status": peer["State"]["Status"],
                "started": peer["State"].get("StartedAt"), "restarts": peer.get("RestartCount"),
                "config": digest(peer.get("Config")), "host": digest(peer.get("HostConfig")),
                "networks": digest(peer.get("NetworkSettings")), "mounts": digest(peer.get("Mounts"))
            } for peer in matches], key=lambda item: item["id"])
        state[service] = entry
        old_images[service] = container["Image"]
    return state, old_images


def freeze(payload, policy):
    state, images = runtime_state(payload, policy, payload["before"])
    frozen = {"format": 2, "policy_sha256": digest(policy), "config_sha256": digest(payload["before"]),
            "runtime_sha256": digest(state),
            "rollback_images": {service: images[service] for service in policy["targets"]},
            "target_containers": {container["Config"]["Labels"]["com.docker.compose.service"]:
                {"id": container["Id"], "started": container["State"].get("StartedAt"),
                 "restarts": container.get("RestartCount"), "raw_sha256": raw_target(container)}
                for container in payload["containers"]
                if container.get("Config", {}).get("Labels", {}).get("com.docker.compose.project") == policy["project"]
                and container["Config"]["Labels"].get("com.docker.compose.service") in policy["targets"]},
            "candidate_images": {service: payload["after"]["services"][service].get("image")
                                 for service in policy["targets"]}}
    check(payload, policy, frozen)
    return frozen


def check(payload, policy, frozen, post=False, candidate_file=None, rollback=False):
    require(frozen.get("format") == 2 and frozen.get("policy_sha256") == digest(policy), "frozen policy mismatch")
    require(frozen.get("config_sha256") == digest(payload["before"]), "frozen base config drift")
    before, after = copy.deepcopy(payload["before"]), copy.deepcopy(payload["after"])
    require(after.get("name") == policy["project"], "candidate project mismatch")
    images = {image["Id"]: image for image in payload["images"]}
    for service in policy["targets"]:
        require(service in after.get("services", {}), "candidate target missing")
        image_id = after["services"][service].get("image", "")
        approved = frozen["rollback_images" if rollback else "candidate_images"][service]
        require(image_id == approved, "image differs from approved frozen plan")
        require(re.fullmatch(r"sha256:[0-9a-f]{64}", image_id) is not None, "verified local image ID required")
        image = images.get(image_id)
        require(image is not None and image.get("Os") == "linux" and image.get("Architecture") == "amd64",
                "candidate must be a locally inspected linux/amd64 image")
        require(after["services"][service].get("pull_policy") == "never", "candidate must disable registry pulls")
        baseline = images.get(frozen["rollback_images"][service])
        require(baseline is not None and "Config" in baseline, "rollback image defaults required")
        definition = payload["before"]["services"][service]
        require(stable_env(effective_env(baseline, definition), definition) ==
                stable_env(effective_env(image, definition), definition), "candidate inherited environment changed")
        # An image-only release must preserve process/user defaults too. Fail closed
        # even if Compose overrides them; a deliberate change needs its own review.
        for key in ("User", "Cmd", "Entrypoint", "WorkingDir", "StopSignal", "Healthcheck", "ExposedPorts", "Volumes", "Shell"):
            require(baseline["Config"].get(key) == image["Config"].get(key), "candidate process defaults changed")
        for key in ["image", "pull_policy"]:
            before["services"][service].pop(key, None)
            after["services"][service].pop(key, None)
    require(before == after, "candidate changes more than selected images")
    config = payload["after"] if post else payload["before"]
    state, current_images = runtime_state(payload, policy, config, post or rollback, candidate_file)
    require(digest(state) == frozen.get("runtime_sha256"), "frozen runtime or untouched service changed")
    if not post and not rollback:
        for container in payload["containers"]:
            labels = container.get("Config", {}).get("Labels", {})
            service = labels.get("com.docker.compose.service")
            if labels.get("com.docker.compose.project") == policy["project"] and service in policy["targets"]:
                identity = {"id": container["Id"], "started": container["State"].get("StartedAt"),
                            "restarts": container.get("RestartCount"), "raw_sha256": raw_target(container)}
                require(identity == frozen["target_containers"][service], "target identity changed before cutover")
    for service in policy["targets"]:
        expected = payload["after"]["services"][service]["image"] if post else frozen["candidate_images" if rollback else "rollback_images"][service]
        require(current_images[service] == expected, "selected service image changed unexpectedly")
        for container in payload["containers"]:
            labels = container.get("Config", {}).get("Labels", {})
            if (post or rollback) and labels.get("com.docker.compose.project") == policy["project"] and labels.get("com.docker.compose.service") == service:
                if "Image" in container["Config"]:
                    require(container["Config"]["Image"] == expected, "runtime image reference drift")
    return {"ok": True, "project": policy["project"], "targets": policy["targets"],
            "mode": "postcheck" if post else "preflight", "rollback": rollback}


def read_json(command):
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=30)
    require(result.returncode == 0, "read-only Docker metadata probe failed")
    return json.loads(result.stdout)


def collect(policy, candidate_file, required_images=()):
    require(candidate_file and Path(candidate_file).is_absolute(), "absolute candidate file required")
    base = ["docker", "compose", "-p", policy["project"], "--project-directory",
            policy["project_dir"], "-f", policy["config_file"]]
    before = read_json(base + ["config", "--format", "json"])
    after = read_json(base + ["-f", candidate_file, "config", "--format", "json"])
    result = subprocess.run(["docker", "ps", "-aq", "--filter",
                             "label=com.docker.compose.project=" + policy["project"]],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=30)
    ids = result.stdout.split()
    require(result.returncode == 0 and ids, "complete container inventory required")
    containers = read_json(["docker", "inspect", *ids])
    image_ids = {container["Image"] for container in containers}
    for image_id in required_images:
        require(re.fullmatch(r"sha256:[0-9a-f]{64}", image_id) is not None, "frozen local image ID required")
        image_ids.add(image_id)
    for service in policy["targets"]:
        image_id = after["services"][service].get("image", "")
        require(re.fullmatch(r"sha256:[0-9a-f]{64}", image_id) is not None, "local candidate image ID required")
        image_ids.add(image_id)
    images = read_json(["docker", "image", "inspect", *sorted(image_ids)])
    return {"before": before, "after": after, "containers": containers, "images": images}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profiles", required=True)
    parser.add_argument("--environment", choices=["qa", "prod"], required=True)
    parser.add_argument("--freeze", action="store_true")
    parser.add_argument("--frozen")
    parser.add_argument("--post", action="store_true")
    parser.add_argument("--rollback", action="store_true")
    parser.add_argument("--candidate-file")
    parser.add_argument("--live", action="store_true", help="explicitly collect read-only local Docker metadata")
    args = parser.parse_args()
    try:
        policy = json.loads(Path(args.profiles).read_text())[args.environment]
        frozen = json.loads(Path(args.frozen).read_text()) if args.frozen else None
        required_images = list((frozen or {}).get("rollback_images", {}).values())
        required_images += list((frozen or {}).get("candidate_images", {}).values())
        payload = collect(policy, args.candidate_file, required_images) if args.live else json.load(sys.stdin)
        if args.freeze:
            require(not args.post and not args.frozen and not args.rollback, "freeze cannot be combined with check")
            result = freeze(payload, policy)
        else:
            require(args.frozen is not None, "frozen approval required")
            result = check(payload, policy, frozen, args.post,
                           args.candidate_file, args.rollback)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (RolloutError, KeyError, TypeError, ValueError, OSError, subprocess.SubprocessError):
        # Never include input values or a traceback: metadata may contain secrets.
        print("STOP: invalid input, configuration/runtime drift, duplicate containers or unapproved image", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
