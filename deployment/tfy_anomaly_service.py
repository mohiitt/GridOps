"""
TrueFoundry deployment helper for the Anomaly Scoring Service.

Use this script to programmatically deploy or update the service via
the TrueFoundry Python SDK (if available).

CLI usage:
  python deployment/tfy_anomaly_service.py --workspace <workspace_fqn>
"""
from __future__ import annotations

import argparse


def deploy(workspace_fqn: str) -> None:
    try:
        import truefoundry.deploy as deploy_sdk
    except ImportError:
        print("truefoundry SDK not installed. Deploy manually using truefoundry.yaml.")
        print("  truefoundry deploy --file deployment/truefoundry.yaml --workspace", workspace_fqn)
        return

    print(f"Deploying gridops-anomaly-service to workspace: {workspace_fqn}")
    # SDK-based deployment would go here


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, help="TrueFoundry workspace FQN")
    args = parser.parse_args()
    deploy(args.workspace)
