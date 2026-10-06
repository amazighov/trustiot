// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

import {TrustIoTDeviceRegistry} from "../contracts/TrustIoTDeviceRegistry.sol";
import {TrustIoTTelemetryCommitments} from "../contracts/TrustIoTTelemetryCommitments.sol";

contract SubmitterActor {
    function commit(
        TrustIoTTelemetryCommitments commitments,
        bytes32 batchId,
        bytes32 deviceId,
        bytes32 commitment
    ) external returns (bool) {
        return commitments.commitBatch(
            batchId,
            deviceId,
            commitment,
            keccak256("trustiot.wmc.telemetry-commitment.v1"),
            1_791_236_131,
            1_791_236_450,
            60
        );
    }
}

contract TrustIoTTelemetryCommitmentsTest {
    bytes32 private constant DEVICE_A = bytes32(uint256(0xA));
    bytes32 private constant DEVICE_B = bytes32(uint256(0xB));
    bytes32 private constant KEY_A = bytes32(uint256(0xAA));
    bytes32 private constant KEY_B = bytes32(uint256(0xBB));

    TrustIoTDeviceRegistry private registry;
    TrustIoTTelemetryCommitments private commitments;
    SubmitterActor private controllerA;
    SubmitterActor private controllerB;
    SubmitterActor private gateway;

    function setUp() public {
        registry = new TrustIoTDeviceRegistry(address(this));
        commitments = new TrustIoTTelemetryCommitments(address(this), address(registry));
        controllerA = new SubmitterActor();
        controllerB = new SubmitterActor();
        gateway = new SubmitterActor();

        registry.registerDevice(DEVICE_A, address(controllerA), KEY_A, bytes32(0));
        registry.registerDevice(DEVICE_B, address(controllerB), KEY_B, bytes32(0));
    }

    function testOwnerCanCommitForActiveDevice() public {
        bool created = commitments.commitBatch(
            bytes32(uint256(1)),
            DEVICE_A,
            bytes32(uint256(101)),
            keccak256("trustiot.wmc.telemetry-commitment.v1"),
            1_791_236_131,
            1_791_236_450,
            60
        );
        require(created, "owner commit should create a batch");
    }

    function testCurrentControllerCanCommitOwnDevice() public {
        bool created = controllerA.commit(
            commitments,
            bytes32(uint256(2)),
            DEVICE_A,
            bytes32(uint256(102))
        );
        require(created, "controller commit should create a batch");
    }

    function testControllerTransferRevokesOldControllerAndAllowsNewController() public {
        registry.transferDeviceController(DEVICE_A, address(controllerB));

        (bool oldControllerSucceeded,) = address(controllerA).call(
            abi.encodeWithSelector(
                SubmitterActor.commit.selector,
                commitments,
                bytes32(uint256(20)),
                DEVICE_A,
                bytes32(uint256(120))
            )
        );

        require(!oldControllerSucceeded, "previous controller must lose authority");

        bool newControllerCreated = controllerB.commit(
            commitments,
            bytes32(uint256(21)),
            DEVICE_A,
            bytes32(uint256(121))
        );

        require(newControllerCreated, "current controller must gain authority");
    }

    function testDeviceScopedGatewayCanCommitAuthorizedDevice() public {
        commitments.setAuthorizedDeviceSubmitter(DEVICE_A, address(gateway), true);
        bool created = gateway.commit(
            commitments,
            bytes32(uint256(3)),
            DEVICE_A,
            bytes32(uint256(103))
        );
        require(created, "device-scoped gateway should be accepted");
    }

    function testGatewayForDeviceACannotCommitForDeviceB() public {
        commitments.setAuthorizedDeviceSubmitter(DEVICE_A, address(gateway), true);

        (bool succeeded,) = address(gateway).call(
            abi.encodeWithSelector(
                SubmitterActor.commit.selector,
                commitments,
                bytes32(uint256(4)),
                DEVICE_B,
                bytes32(uint256(104))
            )
        );

        require(!succeeded, "device A authorization must not authorize device B");
        require(!commitments.batchExists(bytes32(uint256(4))), "rejected batch must not exist");
    }

    function testRevokedGatewayAuthorizationIsRejected() public {
        commitments.setAuthorizedDeviceSubmitter(DEVICE_A, address(gateway), true);
        commitments.setAuthorizedDeviceSubmitter(DEVICE_A, address(gateway), false);

        (bool succeeded,) = address(gateway).call(
            abi.encodeWithSelector(
                SubmitterActor.commit.selector,
                commitments,
                bytes32(uint256(5)),
                DEVICE_A,
                bytes32(uint256(105))
            )
        );

        require(!succeeded, "revoked gateway must be rejected");
    }

    function testInactiveDeviceRejectsEverySubmitter() public {
        commitments.setAuthorizedDeviceSubmitter(DEVICE_A, address(gateway), true);
        registry.setDeviceStatus(DEVICE_A, TrustIoTDeviceRegistry.DeviceStatus.Revoked);

        (bool succeeded,) = address(gateway).call(
            abi.encodeWithSelector(
                SubmitterActor.commit.selector,
                commitments,
                bytes32(uint256(6)),
                DEVICE_A,
                bytes32(uint256(106))
            )
        );

        require(!succeeded, "inactive device must reject authorized gateway");
    }

    function testUnknownDeviceCannotBePreauthorized() public {
        (bool succeeded,) = address(commitments).call(
            abi.encodeWithSelector(
                TrustIoTTelemetryCommitments.setAuthorizedDeviceSubmitter.selector,
                bytes32(uint256(0xC)),
                address(gateway),
                true
            )
        );

        require(!succeeded, "unknown device must not be preauthorized");
    }

    function testIdenticalRetryIsIdempotentAndConflictReverts() public {
        bytes32 batchId = bytes32(uint256(7));
        bytes32 value = bytes32(uint256(107));

        bool created = controllerA.commit(commitments, batchId, DEVICE_A, value);
        require(created, "first commit should create a batch");

        bool repeated = controllerA.commit(commitments, batchId, DEVICE_A, value);
        require(!repeated, "identical retry should be idempotent");

        (bool succeeded,) = address(controllerA).call(
            abi.encodeWithSelector(
                SubmitterActor.commit.selector,
                commitments,
                batchId,
                DEVICE_A,
                bytes32(uint256(108))
            )
        );

        require(!succeeded, "conflicting retry must revert");
    }
}
