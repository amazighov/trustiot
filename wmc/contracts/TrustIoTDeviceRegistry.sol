// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

/// @title TrustIoT device identity registry for World Mobile Chain
/// @notice Stores only fixed-size identity commitments. Public keys and
///         device metadata remain off-chain.
contract TrustIoTDeviceRegistry {
    enum DeviceStatus {
        Unknown,
        Active,
        Revoked
    }

    struct DeviceRecord {
        address controller;
        bytes32 keyFingerprint;
        bytes32 metadataHash;
        uint64 registeredAt;
        uint64 updatedAt;
        DeviceStatus status;
    }

    address public owner;
    address public pendingOwner;
    mapping(bytes32 deviceId => DeviceRecord record) private devices;

    error Unauthorized();
    error ZeroAddress();
    error EmptyValue();
    error DeviceAlreadyRegistered(bytes32 deviceId);
    error DeviceNotFound(bytes32 deviceId);
    error InvalidStatus();

    event OwnershipTransferStarted(address indexed previousOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event DeviceRegistered(
        bytes32 indexed deviceId,
        address indexed controller,
        bytes32 keyFingerprint,
        bytes32 metadataHash
    );
    event DeviceControllerChanged(
        bytes32 indexed deviceId,
        address indexed previousController,
        address indexed newController
    );
    event DeviceKeyUpdated(bytes32 indexed deviceId, bytes32 previousFingerprint, bytes32 newFingerprint);
    event DeviceMetadataUpdated(bytes32 indexed deviceId, bytes32 previousHash, bytes32 newHash);
    event DeviceStatusChanged(bytes32 indexed deviceId, DeviceStatus previousStatus, DeviceStatus newStatus);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyDeviceControllerOrOwner(bytes32 deviceId) {
        DeviceRecord storage record = _requireDevice(deviceId);
        if (msg.sender != owner && msg.sender != record.controller) revert Unauthorized();
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

    function registerDevice(
        bytes32 deviceId,
        address controller,
        bytes32 keyFingerprint,
        bytes32 metadataHash
    ) external onlyOwner {
        if (deviceId == bytes32(0) || keyFingerprint == bytes32(0)) revert EmptyValue();
        if (controller == address(0)) revert ZeroAddress();
        if (devices[deviceId].status != DeviceStatus.Unknown) {
            revert DeviceAlreadyRegistered(deviceId);
        }

        uint64 nowTimestamp = uint64(block.timestamp);
        devices[deviceId] = DeviceRecord({
            controller: controller,
            keyFingerprint: keyFingerprint,
            metadataHash: metadataHash,
            registeredAt: nowTimestamp,
            updatedAt: nowTimestamp,
            status: DeviceStatus.Active
        });

        emit DeviceRegistered(deviceId, controller, keyFingerprint, metadataHash);
    }

    function transferDeviceController(
        bytes32 deviceId,
        address newController
    ) external onlyDeviceControllerOrOwner(deviceId) {
        if (newController == address(0)) revert ZeroAddress();
        DeviceRecord storage record = devices[deviceId];
        address previousController = record.controller;
        record.controller = newController;
        record.updatedAt = uint64(block.timestamp);
        emit DeviceControllerChanged(deviceId, previousController, newController);
    }

    function updateDeviceKey(
        bytes32 deviceId,
        bytes32 newFingerprint
    ) external onlyDeviceControllerOrOwner(deviceId) {
        if (newFingerprint == bytes32(0)) revert EmptyValue();
        DeviceRecord storage record = devices[deviceId];
        bytes32 previousFingerprint = record.keyFingerprint;
        record.keyFingerprint = newFingerprint;
        record.updatedAt = uint64(block.timestamp);
        emit DeviceKeyUpdated(deviceId, previousFingerprint, newFingerprint);
    }

    function updateMetadataHash(
        bytes32 deviceId,
        bytes32 newMetadataHash
    ) external onlyDeviceControllerOrOwner(deviceId) {
        DeviceRecord storage record = devices[deviceId];
        bytes32 previousHash = record.metadataHash;
        record.metadataHash = newMetadataHash;
        record.updatedAt = uint64(block.timestamp);
        emit DeviceMetadataUpdated(deviceId, previousHash, newMetadataHash);
    }

    function setDeviceStatus(bytes32 deviceId, DeviceStatus newStatus) external onlyOwner {
        if (newStatus == DeviceStatus.Unknown) revert InvalidStatus();
        DeviceRecord storage record = _requireDevice(deviceId);
        DeviceStatus previousStatus = record.status;
        record.status = newStatus;
        record.updatedAt = uint64(block.timestamp);
        emit DeviceStatusChanged(deviceId, previousStatus, newStatus);
    }

    function getDevice(bytes32 deviceId) external view returns (DeviceRecord memory) {
        return _requireDevice(deviceId);
    }

    function controllerOf(bytes32 deviceId) external view returns (address) {
        return _requireDevice(deviceId).controller;
    }

    function isDeviceActive(bytes32 deviceId) external view returns (bool) {
        return devices[deviceId].status == DeviceStatus.Active;
    }

    function _requireDevice(bytes32 deviceId) private view returns (DeviceRecord storage record) {
        record = devices[deviceId];
        if (record.status == DeviceStatus.Unknown) revert DeviceNotFound(deviceId);
    }
}
