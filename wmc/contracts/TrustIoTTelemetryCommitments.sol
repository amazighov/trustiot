// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

interface ITrustIoTDeviceRegistry {
    function isDeviceActive(bytes32 deviceId) external view returns (bool);
    function controllerOf(bytes32 deviceId) external view returns (address);
}

/// @title TrustIoT telemetry batch commitments for World Mobile Chain
/// @notice Anchors integrity and provenance metadata, never raw telemetry.
contract TrustIoTTelemetryCommitments {
    struct BatchCommitment {
        bytes32 deviceId;
        bytes32 commitment;
        bytes32 schemaHash;
        address submitter;
        uint64 startedAt;
        uint64 endedAt;
        uint64 committedAt;
        uint32 readingCount;
    }

    address public owner;
    address public pendingOwner;
    ITrustIoTDeviceRegistry public immutable deviceRegistry;
    mapping(bytes32 deviceId => mapping(address submitter => bool authorized))
        public authorizedDeviceSubmitters;
    mapping(bytes32 batchId => BatchCommitment record) private batches;

    error Unauthorized();
    error ZeroAddress();
    error EmptyValue();
    error DeviceNotActive(bytes32 deviceId);
    error InvalidTimeRange();
    error InvalidReadingCount();
    error BatchAlreadyCommitted(bytes32 batchId);
    error BatchNotFound(bytes32 batchId);

    event OwnershipTransferStarted(address indexed previousOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event DeviceSubmitterAuthorizationChanged(
        bytes32 indexed deviceId,
        address indexed submitter,
        bool authorized
    );
    event BatchCommitted(
        bytes32 indexed batchId,
        bytes32 indexed deviceId,
        bytes32 commitment,
        bytes32 schemaHash,
        address submitter,
        uint64 startedAt,
        uint64 endedAt,
        uint32 readingCount
    );

    constructor(address initialOwner, address registryAddress) {
        if (initialOwner == address(0) || registryAddress == address(0)) revert ZeroAddress();
        owner = initialOwner;
        deviceRegistry = ITrustIoTDeviceRegistry(registryAddress);
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function setAuthorizedDeviceSubmitter(
        bytes32 deviceId,
        address submitter,
        bool authorized
    ) external onlyOwner {
        if (deviceId == bytes32(0)) revert EmptyValue();
        if (submitter == address(0)) revert ZeroAddress();

        // Reject pre-authorization for an unknown device. Authorization may be
        // revoked while a known device is inactive, so existence—not active
        // status—is the relevant condition here.
        deviceRegistry.controllerOf(deviceId);

        authorizedDeviceSubmitters[deviceId][submitter] = authorized;
        emit DeviceSubmitterAuthorizationChanged(deviceId, submitter, authorized);
    }

    function commitBatch(
        bytes32 batchId,
        bytes32 deviceId,
        bytes32 commitment,
        bytes32 schemaHash,
        uint64 startedAt,
        uint64 endedAt,
        uint32 readingCount
    ) external returns (bool created) {
        if (batchId == bytes32(0) || deviceId == bytes32(0)
            || commitment == bytes32(0) || schemaHash == bytes32(0)) revert EmptyValue();
        if (startedAt > endedAt) revert InvalidTimeRange();
        if (readingCount == 0) revert InvalidReadingCount();
        if (!deviceRegistry.isDeviceActive(deviceId)) revert DeviceNotActive(deviceId);

        address controller = deviceRegistry.controllerOf(deviceId);
        if (
            msg.sender != owner
                && msg.sender != controller
                && !authorizedDeviceSubmitters[deviceId][msg.sender]
        ) {
            revert Unauthorized();
        }

        BatchCommitment storage existing = batches[batchId];
        if (existing.committedAt != 0) {
            if (_matches(
                existing,
                deviceId,
                commitment,
                schemaHash,
                startedAt,
                endedAt,
                readingCount
            )) return false;
            revert BatchAlreadyCommitted(batchId);
        }

        batches[batchId] = BatchCommitment({
            deviceId: deviceId,
            commitment: commitment,
            schemaHash: schemaHash,
            submitter: msg.sender,
            startedAt: startedAt,
            endedAt: endedAt,
            committedAt: uint64(block.timestamp),
            readingCount: readingCount
        });

        emit BatchCommitted(
            batchId,
            deviceId,
            commitment,
            schemaHash,
            msg.sender,
            startedAt,
            endedAt,
            readingCount
        );
        return true;
    }

    function batchExists(bytes32 batchId) external view returns (bool) {
        return batches[batchId].committedAt != 0;
    }

    function getBatch(bytes32 batchId) external view returns (BatchCommitment memory) {
        BatchCommitment memory record = batches[batchId];
        if (record.committedAt == 0) revert BatchNotFound(batchId);
        return record;
    }

    function _matches(
        BatchCommitment storage existing,
        bytes32 deviceId,
        bytes32 commitment,
        bytes32 schemaHash,
        uint64 startedAt,
        uint64 endedAt,
        uint32 readingCount
    ) private view returns (bool) {
        return existing.deviceId == deviceId
            && existing.commitment == commitment
            && existing.schemaHash == schemaHash
            && existing.startedAt == startedAt
            && existing.endedAt == endedAt
            && existing.readingCount == readingCount;
    }
}
