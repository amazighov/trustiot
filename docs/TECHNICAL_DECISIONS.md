# Technical Decisions

## TD-001 — Filecoin Pin first

The MVP integration targets Filecoin Pin because it provides a current developer-facing path for adding files to Filecoin-backed storage and returns content identifiers that fit the TrustIoT manifest model.

We keep the storage interface abstract so a future Synapse SDK implementation can replace the CLI adapter without changing the IoT domain logic.

## TD-002 — Fabric 2.5 LTS for the grant MVP

Fabric 3.x adds capabilities such as BFT ordering, but the MVP does not need those features. Fabric 2.5 remains the LTS production line, so it is the lower-risk baseline for the grant prototype.

The contract model avoids version-specific features that would prevent a later migration.

## TD-003 — Encrypt before Filecoin

TrustIoT assumes enterprise sensor datasets may be confidential. The gateway therefore encrypts the batch before it leaves the edge/data-owner boundary.

Filecoin stores ciphertext. Fabric public state stores the CID and ciphertext hash.

## TD-004 — Fabric is optional

This is essential for grant alignment. TrustIoT must remain a useful Filecoin onboarding tool even for users who do not run Fabric.

The governance adapter therefore has interchangeable implementations:

- local (developer mode)
- Fabric (enterprise mode)
- other future governance systems

## TD-005 — No distributed-transaction illusion

Filecoin storage and Fabric ledger registration cannot be one atomic transaction.

The production gateway will use explicit workflow states:

`CREATED -> ENCRYPTED -> STORED -> REGISTERED -> VERIFIED`

Failed transitions are retried idempotently.
