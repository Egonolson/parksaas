import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

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
                container["Config"]["Env"][-1] = "NODE_VERSION=new"
                container["Config"]["Labels"]["com.docker.compose.project.config_files"] += "," + overlay
                payload["after"]["services"][service]["image"] = frozen["rollback_images"][service]
        self.assertTrue(guard.check(payload, policy, frozen, candidate_file=overlay, rollback=True)["ok"])
        for container in payload["containers"]:
            service = container["Config"]["Labels"]["com.docker.compose.service"]
            if service in policy["targets"]:
                container["Id"] += "-rollback"
                container["Image"] = frozen["rollback_images"][service]
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


if __name__ == "__main__":
    unittest.main()
