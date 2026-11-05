import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import contextlib
import io

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("rollout_guard", ROOT / "scripts/check-image-rollout.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
POLICIES = json.loads((ROOT / "deploy/image-rollout/profiles.json").read_text())


def image_id(value):
    return "sha256:" + hashlib.sha256(value.encode()).hexdigest()


def fixture(environment="qa"):
    policy = copy.deepcopy(POLICIES[environment])
    network = next(iter(policy["services"].values()))["networks"][0]
    before = {"name": policy["project"], "networks": {"frozen": {"name": network}}, "services": {}}
    containers, images = [], []
    for service, expected in policy["services"].items():
        old = image_id(service + "-old")
        ports = [{"target": int(target.split("/")[0]), "protocol": target.split("/")[1],
                  "published": port, "host_ip": address}
                 for target, binds in expected["ports"].items() for address, port in binds]
        before["services"][service] = {"image": old, "restart": "unless-stopped",
            "environment": {"FIXTURE_MODE": "fixture-only"}, "networks": {"frozen": None}, "ports": ports}
        containers.append({"Id": "container-" + service, "Name": "/" + expected["container"],
            "Image": old, "State": {"Status": "running", "Health": {"Status": "healthy"}},
            "Config": {"Env": ["FIXTURE_MODE=fixture-only", "NODE_VERSION=old"],
                "Labels": {"com.docker.compose.project": policy["project"],
                    "com.docker.compose.service": service,
                    "com.docker.compose.project.working_dir": policy["project_dir"],
                    "com.docker.compose.project.config_files": policy["config_file"]}},
            "HostConfig": {"PortBindings": {target: [{"HostIp": address, "HostPort": port}
                for address, port in binds] for target, binds in expected["ports"].items()},
                "RestartPolicy": {"Name": "unless-stopped"}, "Privileged": False,
                "ReadonlyRootfs": False, "CapAdd": None, "CapDrop": None, "SecurityOpt": None,
                "Memory": 0, "PidsLimit": None},
            "Mounts": [], "NetworkSettings": {"Networks": {network: {}}}})
        images.append({"Id": old, "Os": "linux", "Architecture": "amd64", "Config": {"Env": ["NODE_VERSION=old"]}})
    after = copy.deepcopy(before)
    for service in policy["targets"]:
        new = image_id(service + "-new")
        after["services"][service].update(image=new, pull_policy="never")
        images.append({"Id": new, "Os": "linux", "Architecture": "amd64", "Config": {"Env": ["NODE_VERSION=new"]}})
    return {"before": before, "after": after, "containers": containers, "images": images}, policy


class ImageRolloutTests(unittest.TestCase):
    def test_only_image_inherited_source_revision_may_appear_on_recreate(self):
        payload, policy = fixture()
        key = "org.opencontainers.image.revision"
        revision = hashlib.sha256(b"synthetic-source").hexdigest()
        for service in policy["targets"]:
            candidate = payload["after"]["services"][service]["image"]
            next(image for image in payload["images"] if image["Id"] == candidate)["Config"]["Labels"] = {key: revision}
        frozen = guard.freeze(payload, policy)
        overlay = self.forward(payload, policy)
        for container in payload["containers"]:
            if container["Config"]["Labels"]["com.docker.compose.service"] in policy["targets"]:
                container["Config"]["Labels"][key] = revision
        self.assertTrue(guard.check(payload, policy, frozen, post=True, candidate_file=overlay)["ok"])
        payload["containers"][0]["Config"]["Labels"].pop(key)
        self.assert_blocked(payload, policy, frozen, post=True, candidate_file=overlay)
        payload["containers"][0]["Config"]["Labels"][key] = "manual-override"
        self.assert_blocked(payload, policy, frozen, post=True, candidate_file=overlay)
        payload["containers"][0]["Config"]["Labels"][key] = revision
        for service in policy["targets"]:
            payload["after"]["services"][service]["image"] = frozen["rollback_images"][service]
        self.assertTrue(guard.check(payload, policy, frozen, rollback=True, candidate_file=overlay)["ok"])
        for container in payload["containers"]:
            service = container["Config"]["Labels"]["com.docker.compose.service"]
            if service in policy["targets"]:
                container["Image"] = frozen["rollback_images"][service]
                container["Config"]["Env"][-1] = "NODE_VERSION=old"
                container["Config"]["Labels"].pop(key)
        self.assertTrue(guard.check(payload, policy, frozen, post=True, rollback=True, candidate_file=overlay)["ok"])

    def test_manual_revision_without_image_default_is_rejected_before_freeze(self):
        payload, policy = fixture()
        payload["containers"][0]["Config"]["Labels"]["org.opencontainers.image.revision"] = "manual-override"
        self.assert_blocked(payload, policy)

    def test_compose_revision_override_and_other_inherited_labels_stay_frozen(self):
        key = "org.opencontainers.image.revision"
        payload, policy = fixture()
        service = policy["targets"][0]
        for model in [payload["before"], payload["after"]]:
            model["services"][service]["labels"] = {key: "declared-runtime-revision"}
        payload["containers"][0]["Config"]["Labels"][key] = "declared-runtime-revision"
        candidate = payload["after"]["services"][service]["image"]
        next(image for image in payload["images"] if image["Id"] == candidate)["Config"]["Labels"] = {key: "new-image-default"}
        frozen = guard.freeze(payload, policy)
        overlay = self.forward(payload, policy)
        self.assertTrue(guard.check(payload, policy, frozen, post=True, candidate_file=overlay)["ok"])
        payload["containers"][0]["Config"]["Labels"][key] = "new-image-default"
        self.assert_blocked(payload, policy, frozen, post=True, candidate_file=overlay)
        for other in ["org.opencontainers.image.version", "unrecognized.label", "traefik.http.routers.app.rule"]:
            with self.subTest(key=other):
                payload, policy = fixture()
                frozen = guard.freeze(payload, policy)
                overlay = self.forward(payload, policy)
                container = payload["containers"][0]
                container["Config"]["Labels"][other] = "new-inherited-value"
                next(image for image in payload["images"] if image["Id"] == container["Image"])["Config"]["Labels"] = {other: "new-inherited-value"}
                self.assert_blocked(payload, policy, frozen, post=True, candidate_file=overlay)

    def test_revision_metadata_normalization_does_not_relax_raw_preflight_hash(self):
        payload, policy = fixture()
        key = "org.opencontainers.image.revision"
        container = payload["containers"][0]
        image = next(image for image in payload["images"] if image["Id"] == container["Image"])
        image["Config"]["Labels"] = {key: "old-source"}
        container["Config"]["Labels"][key] = "old-source"
        frozen = guard.freeze(payload, policy)
        image["Config"]["Labels"][key] = "changed-source"
        container["Config"]["Labels"][key] = "changed-source"
        self.assert_blocked(payload, policy, frozen)

    def private_snapshot_files(self, directory):
        root = Path(directory).resolve()
        project, checkpoint = root / "project", root / "checkpoint"
        project.mkdir(mode=0o700)
        checkpoint.mkdir(mode=0o700)
        for name, value in [("base.yml", "services: {}\n"), (".env", "FIXTURE_MODE=fixture-only\n")]:
            for folder in [project, checkpoint]:
                path = folder / name
                path.write_text(value)
                path.chmod(0o600)
        policy = {"project_dir": str(project), "config_file": str(project / "base.yml")}
        return policy, project, checkpoint

    def test_original_path_aliases_and_hardlinks_are_not_independent_snapshots(self):
        for name in ["base.yml", ".env"]:
            for kind in ["dotdot-alias", "hardlink"]:
                with self.subTest(name=name, kind=kind), tempfile.TemporaryDirectory(prefix="rollout-independent-fixture-") as directory:
                    policy, project, checkpoint = self.private_snapshot_files(directory)
                    guard.runtime_file_metadata(policy, str(checkpoint / "images.yml"),
                                                str(checkpoint / "base.yml"), str(checkpoint / ".env"), True)
                    if kind == "dotdot-alias":
                        snapshot = project / ".." / project.name / name
                    else:
                        snapshot = checkpoint / name
                        snapshot.unlink()
                        os.link(project / name, snapshot)
                    base = str(snapshot if name == "base.yml" else checkpoint / "base.yml")
                    env = str(snapshot if name == ".env" else checkpoint / ".env")
                    with self.assertRaises(guard.RolloutError):
                        guard.runtime_file_metadata(policy, str(checkpoint / "images.yml"), base, env, True)

    def test_independent_snapshot_paths_are_normalized_and_originals_not_read_after_swap(self):
        with tempfile.TemporaryDirectory(prefix="rollout-independent-fixture-") as directory:
            policy, project, checkpoint = self.private_snapshot_files(directory)
            base = str(checkpoint / ".." / checkpoint.name / "base.yml")
            env = str(checkpoint / ".." / checkpoint.name / ".env")
            files, original = guard.runtime_file_metadata(policy, str(checkpoint / "images.yml"), base, env, True)
            self.assertEqual(files["base_file"], str(checkpoint / "base.yml"))
            self.assertEqual(files["env_file"], str(checkpoint / ".env"))
            (project / "base.yml").unlink()
            (project / ".env").unlink()
            after, absent = guard.runtime_file_metadata(policy, str(checkpoint / "images.yml"), base, env, False)
            self.assertEqual(after, files)
            self.assertIsNone(absent)
            self.assertIsNotNone(original)

    def snapshot_fixture(self):
        payload, policy = fixture()
        payload["runtime_files"] = {"base_file": "/checkpoint/base.compose.yml", "env_file": "/checkpoint/runtime.env",
            "candidate_file": "/checkpoint/images.compose.yaml", "base_sha256": "a" * 64, "env_sha256": "b" * 64}
        payload["original_files"] = {"base_sha256": "a" * 64, "env_sha256": "b" * 64}
        return payload, policy

    def test_frozen_file_paths_hashes_and_overlay_cannot_change(self):
        for key in ["base_file", "env_file", "candidate_file", "base_sha256", "env_sha256"]:
            with self.subTest(key=key):
                payload, policy = self.snapshot_fixture()
                frozen = guard.freeze(payload, policy)
                payload["runtime_files"][key] += "-changed"
                self.assert_blocked(payload, policy, frozen)

    def test_original_file_drift_stops_initial_freeze_and_forward_preflight(self):
        for key in ["base_sha256", "env_sha256"]:
            with self.subTest(key=key):
                payload, policy = self.snapshot_fixture()
                frozen = guard.freeze(payload, policy)
                payload["original_files"][key] = "c" * 64
                self.assert_blocked(payload, policy)
                self.assert_blocked(payload, policy, frozen)

    def test_snapshot_provenance_is_required_after_swap_and_for_rollback(self):
        payload, policy = self.snapshot_fixture()
        labels = payload["containers"][0]["Config"]["Labels"]
        labels["com.docker.compose.project.config_files"] = payload["runtime_files"]["base_file"]
        self.assert_blocked(payload, policy)
        labels["com.docker.compose.project.config_files"] = policy["config_file"]
        frozen = guard.freeze(payload, policy)
        overlay = self.forward(payload, policy, payload["runtime_files"]["candidate_file"])
        # The operator's original files may change after a failed cutover. The
        # rollback still resolves ONLY the immutable checkpoint files.
        payload.pop("original_files")
        for container in payload["containers"]:
            if container["Config"]["Labels"]["com.docker.compose.service"] in policy["targets"]:
                container["Config"]["Labels"]["com.docker.compose.project.config_files"] = payload["runtime_files"]["base_file"] + "," + overlay
        self.assertTrue(guard.check(payload, policy, frozen, post=True, candidate_file=overlay)["ok"])
        self.assert_blocked(payload, policy, frozen, post=True, candidate_file="/different/overlay.yaml")
        for service in policy["targets"]:
            payload["after"]["services"][service]["image"] = frozen["rollback_images"][service]
        self.assertTrue(guard.check(payload, policy, frozen, rollback=True, candidate_file=overlay)["ok"])
        for container in payload["containers"]:
            service = container["Config"]["Labels"]["com.docker.compose.service"]
            if service in policy["targets"]:
                container["Image"] = frozen["rollback_images"][service]
                container["Config"]["Env"][-1] = "NODE_VERSION=old"
        self.assertTrue(guard.check(payload, policy, frozen, post=True, rollback=True, candidate_file=overlay)["ok"])
        payload["containers"][0]["Config"]["Labels"]["com.docker.compose.project.config_files"] = policy["config_file"] + "," + overlay
        self.assert_blocked(payload, policy, frozen, post=True, rollback=True, candidate_file=overlay)

    def test_snapshot_cli_uses_same_private_files_after_originals_are_missing(self):
        payload, policy = fixture()
        with tempfile.TemporaryDirectory(prefix="rollout-private-fixture-") as directory:
            root = Path(directory).resolve()
            original, checkpoint = root / "original", root / "checkpoint"
            original.mkdir(mode=0o700)
            checkpoint.mkdir(mode=0o700)
            policy.update(project_dir=str(original), config_file=str(original / "base.yml"))
            for name, content in [("base.yml", "services: {}\n"), (".env", "FIXTURE_MODE=fixture-only\n")]:
                for folder in [original, checkpoint]:
                    path = folder / name
                    path.write_text(content)
                    path.chmod(0o600)
            for container in payload["containers"]:
                container["Config"]["Labels"].update({"com.docker.compose.project.working_dir": str(original),
                    "com.docker.compose.project.config_files": policy["config_file"]})
            overlay, base, env = map(str, [checkpoint / "images.yml", checkpoint / "base.yml", checkpoint / ".env"])
            commands = []

            def metadata(command):
                commands.append(command)
                if command[:2] == ["docker", "compose"]:
                    self.assertEqual(command[command.index("--project-directory") + 1], str(original))
                    self.assertEqual(command[command.index("--env-file") + 1], env)
                    self.assertEqual(command[command.index("-f") + 1], base)
                    return payload["after"] if overlay in command else payload["before"]
                if command[:2] == ["docker", "inspect"]:
                    self.assertEqual(set(command[2:]), {container["Id"] for container in payload["containers"]})
                    return payload["containers"]
                self.assertEqual(command[:3], ["docker", "image", "inspect"])
                return [image for image in payload["images"] if image["Id"] in command[3:]]

            def listing(command, **options):
                return subprocess.CompletedProcess(command, 0, "\n".join(container["Id"] for container in payload["containers"]))

            with mock.patch.object(guard, "read_json", side_effect=metadata), \
                 mock.patch.object(guard.subprocess, "run", side_effect=listing):
                collected = guard.collect(policy, overlay, runtime_base_file=base, runtime_env_file=env)
                frozen = guard.freeze(collected, policy)
                (original / "base.yml").write_text("changed original\n")
                with self.assertRaises(guard.RolloutError):
                    guard.collect(policy, overlay, runtime_base_file=base, runtime_env_file=env)
                (original / "base.yml").unlink()
                (original / ".env").unlink()
                self.forward(payload, policy, overlay)
                for container in payload["containers"]:
                    if container["Config"]["Labels"]["com.docker.compose.service"] in policy["targets"]:
                        container["Config"]["Labels"]["com.docker.compose.project.config_files"] = base + "," + overlay
                profiles_path, frozen_path = root / "profiles.json", root / "frozen.json"
                profiles_path.write_text(json.dumps({"qa": policy}))
                frozen_path.write_text(json.dumps(frozen))
                argv = ["guard", "--profiles", str(profiles_path), "--environment", "qa", "--live", "--post",
                        "--candidate-file", overlay, "--runtime-base-file", base, "--runtime-env-file", env,
                        "--frozen", str(frozen_path)]
                stdout, stderr = io.StringIO(), io.StringIO()
                with mock.patch.object(sys, "argv", argv), contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                    self.assertEqual(guard.main(), 0, stderr.getvalue())
                self.assertTrue(json.loads(stdout.getvalue())["ok"])
                self.assertNotIn("fixture-only", stdout.getvalue() + stderr.getvalue())
                for service in policy["targets"]:
                    payload["after"]["services"][service]["image"] = frozen["rollback_images"][service]
                argv.remove("--post")
                argv.append("--rollback")
                with mock.patch.object(sys, "argv", argv), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(guard.main(), 0)
                for container in payload["containers"]:
                    service = container["Config"]["Labels"]["com.docker.compose.service"]
                    if service in policy["targets"]:
                        container["Id"] += "-rollback"
                        container["Image"] = frozen["rollback_images"][service]
                        container["Config"]["Env"][-1] = "NODE_VERSION=old"
                argv.append("--post")
                with mock.patch.object(sys, "argv", argv), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(guard.main(), 0)
                self.assertEqual((checkpoint / "base.yml").read_text(), "services: {}\n")
                self.assertEqual((checkpoint / ".env").read_text(), "FIXTURE_MODE=fixture-only\n")
                self.assertFalse((original / "base.yml").exists())
                self.assertFalse((original / ".env").exists())

    def test_runtime_snapshot_requires_private_regular_absolute_files(self):
        with tempfile.TemporaryDirectory(prefix="rollout-private-fixture-") as directory:
            path = Path(directory) / "fixture.env"
            path.write_text("FIXTURE_MODE=fixture-only\n")
            path.chmod(0o600)
            self.assertEqual(guard.file_digest(str(path), True), hashlib.sha256(path.read_bytes()).hexdigest())
            path.chmod(0o644)
            with self.assertRaises(guard.RolloutError):
                guard.file_digest(str(path), True)
            path.chmod(0o600)
            link = Path(directory) / "link.env"
            link.symlink_to(path)
            with self.assertRaises(guard.RolloutError):
                guard.file_digest(str(link), True)
            with self.assertRaises(guard.RolloutError):
                guard.file_digest("relative.env", True)

    def forward(self, payload, policy, overlay="/fixture/images.compose.yaml"):
        for container in payload["containers"]:
            service = container["Config"]["Labels"]["com.docker.compose.service"]
            if service in policy["targets"]:
                container["Id"] += "-new"
                container["Image"] = payload["after"]["services"][service]["image"]
                container["Config"]["Env"][-1] = "NODE_VERSION=new"
                container["Config"]["Labels"]["com.docker.compose.project.config_files"] += "," + overlay
        return overlay

    def test_full_target_metadata_drift_is_rejected_before_and_after_cutover(self):
        changes = [
            ("HostConfig", "CpuQuota", 20000),
            ("HostConfig", "Ulimits", [{"Name": "nofile", "Soft": 1000, "Hard": 1000}]),
            ("HostConfig", "LogConfig", {"Type": "none", "Config": {}}),
            ("Config", "User", "unexpected-root"),
            ("Config", "Cmd", ["sh", "-c", "false"]),
            ("NetworkSettings", "Ports", {"9999/tcp": [{"HostIp": "0.0.0.0", "HostPort": "9999"}]}),
        ]
        for section, key, value in changes:
            for post in [False, True]:
                with self.subTest(section=section, key=key, post=post):
                    payload, policy = fixture()
                    frozen = guard.freeze(payload, policy)
                    overlay = self.forward(payload, policy) if post else None
                    payload["containers"][0][section][key] = value
                    self.assert_blocked(payload, policy, frozen, post=post, candidate_file=overlay)

    def test_candidate_must_preserve_mail_and_unknown_inherited_environment(self):
        for key in ["MAIL_MODE", "UNRECOGNIZED_INHERITED", "APP_VERSION"]:
            with self.subTest(key=key):
                payload, policy = fixture()
                container = payload["containers"][0]
                container["Config"]["Env"].append(key + "=local-sink")
                old = next(i for i in payload["images"] if i["Id"] == container["Image"])
                old["Config"]["Env"].append(key + "=local-sink")
                new_id = payload["after"]["services"][policy["targets"][0]]["image"]
                new = next(i for i in payload["images"] if i["Id"] == new_id)
                new["Config"]["Env"].append(key + "=external")
                self.assert_blocked(payload, policy)

    def test_candidate_cannot_silently_change_image_user_or_command(self):
        for key, value in [("User", "root"), ("Cmd", ["unexpected-command"])]:
            with self.subTest(key=key):
                payload, policy = fixture()
                new_id = payload["after"]["services"][policy["targets"][0]]["image"]
                next(i for i in payload["images"] if i["Id"] == new_id)["Config"][key] = value
                self.assert_blocked(payload, policy)

    def test_manual_runtime_process_override_would_not_be_lost_at_recreate(self):
        for key, value in [("User", "manual-user"), ("Cmd", ["manual-command"]),
                           ("Entrypoint", ["manual-entrypoint"]), ("WorkingDir", "/manual-dir")]:
            with self.subTest(key=key):
                payload, policy = fixture()
                payload["containers"][0]["Config"][key] = value
                self.assert_blocked(payload, policy)

    def test_effective_environment_remains_frozen_after_cutover(self):
        for key in ["MAIL_MODE", "UNRECOGNIZED_INHERITED", "APP_VERSION"]:
            with self.subTest(key=key):
                payload, policy = fixture()
                container = payload["containers"][0]
                container["Config"]["Env"].append(key + "=local-sink")
                service = policy["targets"][0]
                for image in payload["images"]:
                    if image["Id"] in (container["Image"], payload["after"]["services"][service]["image"]):
                        image["Config"]["Env"].append(key + "=local-sink")
                frozen = guard.freeze(payload, policy)
                # Restore NODE_VERSION ordering expected by the forward fixture.
                container["Config"]["Env"].sort(key=lambda value: value.startswith("NODE_VERSION="))
                overlay = self.forward(payload, policy)
                container["Config"]["Env"] = [key + "=external" if item.startswith(key + "=") else item
                                               for item in container["Config"]["Env"]]
                self.assert_blocked(payload, policy, frozen, post=True, candidate_file=overlay)

    def test_only_allocator_generated_endpoint_metadata_can_change_on_recreate(self):
        payload, policy = fixture()
        container = payload["containers"][0]
        container["Id"] = "a" * 64
        container["Config"].update(Hostname=container["Id"][:12], Image=container["Image"])
        settings = container["NetworkSettings"]
        settings.update(SandboxID="old-sandbox", SandboxKey="/old/sandbox", Ports={})
        endpoint = next(iter(settings["Networks"].values()))
        endpoint.update(NetworkID="frozen-network-id", EndpointID="old-endpoint", IPAddress="172.20.0.2",
                        GlobalIPv6Address="", MacAddress="02:42:ac:14:00:02", Gateway="172.20.0.1",
                        IPPrefixLen=16, Aliases=["backend", container["Id"][:12]])
        frozen = guard.freeze(payload, policy)
        overlay = self.forward(payload, policy)
        container["Id"] = "b" * 64
        container["Config"].update(Hostname=container["Id"][:12], Image=container["Image"])
        settings.update(SandboxID="new-sandbox", SandboxKey="/new/sandbox")
        endpoint.update(EndpointID="new-endpoint", IPAddress="172.20.0.3",
                        MacAddress="02:42:ac:14:00:03", Aliases=["backend", container["Id"][:12]])
        self.assertTrue(guard.check(payload, policy, frozen, post=True, candidate_file=overlay)["ok"])
        for key, value in [("NetworkID", "unapproved-network"), ("Gateway", "172.20.0.254"),
                           ("Aliases", ["unapproved-alias"]), ("IPPrefixLen", 24)]:
            with self.subTest(key=key):
                original = endpoint[key]
                endpoint[key] = value
                self.assert_blocked(payload, policy, frozen, post=True, candidate_file=overlay)
                endpoint[key] = original

    def test_static_ip_and_custom_hostname_are_not_normalized(self):
        payload, policy = fixture()
        service = policy["targets"][0]
        for model in [payload["before"], payload["after"]]:
            model["services"][service]["networks"]["frozen"] = {"ipv4_address": "172.20.0.2"}
            model["services"][service]["hostname"] = "fixed-host"
        container = payload["containers"][0]
        container["Config"]["Hostname"] = "fixed-host"
        endpoint = next(iter(container["NetworkSettings"]["Networks"].values()))
        endpoint["IPAddress"] = "172.20.0.2"
        frozen = guard.freeze(payload, policy)
        overlay = self.forward(payload, policy)
        endpoint["IPAddress"] = "172.20.0.3"
        self.assert_blocked(payload, policy, frozen, post=True, candidate_file=overlay)
        endpoint["IPAddress"] = "172.20.0.2"
        container["Config"]["Hostname"] = "unexpected-host"
        self.assert_blocked(payload, policy, frozen, post=True, candidate_file=overlay)

    def test_declared_version_variables_and_duplicate_keys_are_not_exempt(self):
        payload, policy = fixture()
        service = policy["targets"][0]
        for model in [payload["before"], payload["after"]]:
            model["services"][service]["environment"]["NODE_VERSION"] = "old"
        frozen = guard.freeze(payload, policy)
        overlay = self.forward(payload, policy)
        self.assert_blocked(payload, policy, frozen, post=True, candidate_file=overlay)
        payload, policy = fixture()
        payload["containers"][0]["Config"]["Env"].append("NODE_VERSION=duplicate")
        self.assert_blocked(payload, policy)

    def assert_blocked(self, payload, policy, frozen=None, **options):
        with self.assertRaises(guard.RolloutError):
            if frozen is None:
                guard.freeze(payload, policy)
            else:
                guard.check(payload, policy, frozen, **options)

    def test_valid_image_only_change_for_both_profiles(self):
        for environment in POLICIES:
            with self.subTest(environment=environment):
                payload, policy = fixture(environment)
                frozen = guard.freeze(payload, policy)
                self.assertNotIn("fixture-only", json.dumps(frozen))
                self.assertTrue(guard.check(payload, policy, frozen)["ok"])

    def test_stopped_retained_target_aborts_before_compose(self):
        payload, policy = fixture()
        retained = copy.deepcopy(payload["containers"][0])
        retained["Name"] += "-retained"
        retained["Id"] += "-retained"
        retained["State"]["Status"] = "exited"
        payload["containers"].append(retained)
        self.assert_blocked(payload, policy)

    def test_stopped_peer_retain_is_allowed_but_must_remain_unchanged(self):
        payload, policy = fixture()
        retained = copy.deepcopy(payload["containers"][-1])
        retained["Name"] += "-retained"
        retained["Id"] += "-retained"
        retained["State"]["Status"] = "exited"
        payload["containers"].append(retained)
        frozen = guard.freeze(payload, policy)
        self.assertTrue(guard.check(payload, policy, frozen)["ok"])
        retained["State"]["StartedAt"] = "unexpected-restart"
        self.assert_blocked(payload, policy, frozen)

    def test_target_replacement_with_the_same_image_is_still_concurrent_drift(self):
        payload, policy = fixture()
        frozen = guard.freeze(payload, policy)
        payload["containers"][0]["Id"] += "-replacement"
        self.assert_blocked(payload, policy, frozen)

    def test_service_environment_change_is_not_image_only(self):
        payload, policy = fixture()
        frozen = guard.freeze(payload, policy)
        payload["after"]["services"][policy["targets"][0]]["environment"]["FIXTURE_MODE"] = "changed"
        self.assert_blocked(payload, policy, frozen)

    def test_wildcard_binding_is_rejected_even_if_config_and_runtime_agree(self):
        payload, policy = fixture()
        for service, expected in policy["services"].items():
            if expected["ports"]:
                payload["before"]["services"][service]["ports"][0]["host_ip"] = "0.0.0.0"
                target = next(iter(expected["ports"]))
                next(c for c in payload["containers"] if c["Config"]["Labels"]["com.docker.compose.service"] == service)["HostConfig"]["PortBindings"][target][0]["HostIp"] = "0.0.0.0"
                break
        self.assert_blocked(payload, policy)

    def test_runtime_network_drift_aborts(self):
        payload, policy = fixture()
        payload["containers"][0]["NetworkSettings"]["Networks"] = {"unexpected_default": {}}
        self.assert_blocked(payload, policy)

    def test_runtime_only_environment_would_not_be_silently_discarded(self):
        payload, policy = fixture()
        payload["containers"][0]["Config"]["Env"].append("UNDECLARED_MODE=fixture-only")
        self.assert_blocked(payload, policy)

    def test_unapproved_mount_aborts(self):
        payload, policy = fixture()
        payload["containers"][0]["Mounts"] = [{"Type": "bind", "Source": "/fixture/unapproved",
            "Destination": "/data", "RW": False}]
        self.assert_blocked(payload, policy)

    def test_unresolved_environment_file_aborts(self):
        payload, policy = fixture()
        payload["before"]["services"][policy["targets"][0]]["env_file"] = ["fixture.env"]
        self.assert_blocked(payload, policy)

    def test_runtime_environment_mismatch_aborts_without_exposing_value(self):
        payload, policy = fixture()
        payload["containers"][0]["Config"]["Env"][0] = "FIXTURE_MODE=must-not-be-printed"
        with self.assertRaises(guard.RolloutError) as error:
            guard.freeze(payload, policy)
        self.assertNotIn("must-not-be-printed", str(error.exception))

    def test_hardening_drift_aborts(self):
        payload, policy = fixture()
        payload["containers"][0]["HostConfig"]["Privileged"] = True
        self.assert_blocked(payload, policy)

    def test_mutable_tag_is_rejected(self):
        payload, policy = fixture()
        frozen = guard.freeze(payload, policy)
        payload["after"]["services"][policy["targets"][0]]["image"] = "candidate:latest"
        self.assert_blocked(payload, policy, frozen)

    def test_a_different_valid_image_cannot_replace_the_approved_candidate(self):
        payload, policy = fixture()
        frozen = guard.freeze(payload, policy)
        unexpected = image_id("unapproved")
        payload["after"]["services"][policy["targets"][0]]["image"] = unexpected
        payload["images"].append({"Id": unexpected, "Os": "linux", "Architecture": "amd64",
            "Config": {"Env": ["NODE_VERSION=new"]}})
        self.assert_blocked(payload, policy, frozen)

    def test_wrong_image_platform_is_rejected(self):
        payload, policy = fixture()
        frozen = guard.freeze(payload, policy)
        payload["images"][-1]["Architecture"] = "arm64"
        self.assert_blocked(payload, policy, frozen)

    def test_concurrent_runtime_replacement_is_rejected(self):
        payload, policy = fixture()
        frozen = guard.freeze(payload, policy)
        payload["containers"][-1]["Id"] = "unexpected-replacement"
        self.assert_blocked(payload, policy, frozen)

    def test_postcheck_allows_only_target_replacement(self):
        payload, policy = fixture()
        frozen = guard.freeze(payload, policy)
        overlay = "/fixture/images.compose.yaml"
        for container in payload["containers"]:
            service = container["Config"]["Labels"]["com.docker.compose.service"]
            if service in policy["targets"]:
                container["Id"] += "-new"
                container["Image"] = payload["after"]["services"][service]["image"]
                container["Config"]["Env"][-1] = "NODE_VERSION=new"
                container["Config"]["Labels"]["com.docker.compose.project.config_files"] += "," + overlay
        self.assertTrue(guard.check(payload, policy, frozen, post=True, candidate_file=overlay)["ok"])
        payload["containers"][-1]["Id"] += "-unexpected"
        self.assert_blocked(payload, policy, frozen, post=True, candidate_file=overlay)

    def test_rollback_checks_the_forward_image_then_restores_only_frozen_ids(self):
        payload, policy = fixture()
        frozen = guard.freeze(payload, policy)
        overlay = "/fixture/images.compose.yaml"
        for container in payload["containers"]:
            service = container["Config"]["Labels"]["com.docker.compose.service"]
            if service in policy["targets"]:
                container["Id"] += "-forward"
                container["Image"] = frozen["candidate_images"][service]
                container["Config"]["Image"] = container["Image"]
                container["Config"]["Env"][-1] = "NODE_VERSION=new"
                container["Config"]["Labels"]["com.docker.compose.project.config_files"] += "," + overlay
                payload["after"]["services"][service]["image"] = frozen["rollback_images"][service]
        self.assertTrue(guard.check(payload, policy, frozen, candidate_file=overlay, rollback=True)["ok"])
        for container in payload["containers"]:
            service = container["Config"]["Labels"]["com.docker.compose.service"]
            if service in policy["targets"]:
                container["Id"] += "-rollback"
                container["Image"] = frozen["rollback_images"][service]
                container["Config"]["Image"] = container["Image"]
                container["Config"]["Env"][-1] = "NODE_VERSION=old"
        self.assertTrue(guard.check(payload, policy, frozen, post=True, candidate_file=overlay, rollback=True)["ok"])

    def test_cli_has_no_docker_action_by_default_and_redacts_invalid_input(self):
        payload, policy = fixture()
        with tempfile.TemporaryDirectory(prefix="image-guard-cli-") as directory:
            frozen_path = Path(directory) / "frozen.json"
            frozen_path.write_text(json.dumps(guard.freeze(payload, policy)))
            command = [sys.executable, "-B", str(ROOT / "scripts/check-image-rollout.py"),
                "--profiles", str(ROOT / "deploy/image-rollout/profiles.json"),
                "--environment", "qa", "--frozen", str(frozen_path)]
            result = subprocess.run(command, input=json.dumps(payload), text=True, capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 0)
            self.assertTrue(json.loads(result.stdout)["ok"])
            self.assertNotIn("fixture-only", result.stdout)
            result = subprocess.run(command, input='{"sensitive": "must-not-be-printed"}',
                text=True, capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 1)
            self.assertNotIn("must-not-be-printed", result.stdout + result.stderr)
            self.assertNotIn("Traceback", result.stderr)

    def test_live_postcheck_keeps_rollback_metadata_available_without_mutation(self):
        payload, policy = fixture()
        frozen = guard.freeze(payload, policy)
        overlay = self.forward(payload, policy)
        requests = []

        def metadata(command):
            requests.append(command)
            if command[:2] == ["docker", "compose"]:
                return payload["after"] if overlay in command else payload["before"]
            if command[:2] == ["docker", "inspect"]:
                return payload["containers"]
            self.assertEqual(command[:3], ["docker", "image", "inspect"])
            return [image for image in payload["images"] if image["Id"] in command[3:]]

        with tempfile.TemporaryDirectory(prefix="image-guard-live-fixture-") as directory:
            frozen_path = Path(directory) / "frozen.json"
            frozen_path.write_text(json.dumps(frozen))
            argv = ["guard", "--profiles", str(ROOT / "deploy/image-rollout/profiles.json"),
                    "--environment", "qa", "--live", "--post", "--candidate-file", overlay,
                    "--frozen", str(frozen_path)]
            stdout, stderr = io.StringIO(), io.StringIO()
            ids = "\n".join(container["Id"] for container in payload["containers"])
            with mock.patch.object(sys, "argv", argv), mock.patch.object(guard, "read_json", side_effect=metadata), \
                 mock.patch.object(guard.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, ids)) as probe, \
                 contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                self.assertEqual(guard.main(), 0, stderr.getvalue())
            self.assertTrue(json.loads(stdout.getvalue())["ok"])
            self.assertNotIn("fixture-only", stdout.getvalue() + stderr.getvalue())
            self.assertEqual(probe.call_args.args[0], ["docker", "ps", "-aq", "--filter",
                                                     "label=com.docker.compose.project=" + policy["project"]])
            inspect = next(command for command in requests if command[:3] == ["docker", "image", "inspect"])
            self.assertTrue(set(frozen["rollback_images"].values()).issubset(inspect[3:]))


if __name__ == "__main__":
    unittest.main()
