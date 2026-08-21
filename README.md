# Sui Agent Policy Control Plane

Sui Agent Policy Control Plane adalah control plane berbasis Sui-native yang memungkinkan AI agent menemukan layanan digital terdaftar, menyiapkan payment intent, membuktikan kepatuhan pada kebijakan yang ditentukan manusia, mengeksekusi pembayaran di Sui, dan melampirkan bukti/receipt terverifikasi pada hasil kerja. Bukan wallet, bukan trading bot, bukan payment rail baru — melainkan lapisan otorisasi kebijakan yang di-enforce lewat Move object.

Status: Tier D — vertical slice lokal selesai; publish/settlement testnet terblokir karena Sui CLI tidak tersedia di workflow

Prasyarat:
- Sui CLI 1.78.0
- Node.js v24.13.0
- npm 11.6.2
- Wallet Sui testnet (funded untuk publish/settlement nyata)

Yang sudah tersedia secara lokal: deterministic policy planner, validasi schema,
endpoint prepare/execute dengan reason-hash verification dan server-side
revalidation, simulator web tiga skenario, serta test integration Node.
Identifier `local-demo-*` bukan transaction digest on-chain.