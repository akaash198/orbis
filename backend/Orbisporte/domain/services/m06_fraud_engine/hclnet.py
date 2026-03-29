"""
HCLNet — Hypergraph Contrastive Learning Network  (SOP FRAUD-005)
=================================================================
Detects shell company networks, related-party pricing abuse, split-shipment
fraud, and country-of-origin fraud by learning entity embeddings over a
hypergraph of trade relationships.

Why Hypergraph (not standard GNN)?
-----------------------------------
A standard graph edge connects exactly 2 nodes (importer ↔ exporter).
A single shipment involves N entities simultaneously:
  importer, exporter, carrier, COO, port, HSN code
A *hyperedge* models this N-way relationship in one structure.
This captures co-occurrence patterns that pairwise edges miss — e.g.
the same exporter appearing with 12 different importers all sharing
one address is a hyperedge-level signal invisible to standard GNNs.

Architecture
------------
1. Hypergraph construction
   - Nodes  V : importers, exporters, carriers, countries, HSN codes
   - Hyperedges E : one per shipment, connecting all entities in that shipment
   - Incidence matrix H ∈ {0,1}^{N×M}

2. HyperConv message-passing (spectral)
   X' = D_v^{-1} H W D_e^{-1} H^T X Θ
   where D_v = node degree, D_e = hyperedge degree, W = edge weights

3. Contrastive learning (NT-Xent)
   - Two augmented views: randomly drop 20% of hyperedges per view
   - Positive pairs: same node across both views
   - Loss: maximise agreement within pair, minimise with all other nodes

4. Fraud scoring
   - Compare each node embedding to stored fraud-prototype centroids
   - cosine_distance to nearest fraud prototype → scaled 0-100

Model file: models/m06_hclnet.pt
Fallback  : Louvain community detection on NetworkX graph (always available)

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# ── Optional PyTorch import ───────────────────────────────────────────────────
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False
    logger.warning("[HCLNet] PyTorch not found — HCLNet will use rule-based fallback")


# =============================================================================
# HyperConv Layer
# =============================================================================

class HypergraphConv(nn.Module):  # type: ignore[misc]
    """
    Spectral hypergraph convolution layer.

    Forward pass implements:
        X' = D_v^{-1} H W D_e^{-1} H^T X Θ

    Parameters
    ----------
    in_channels  : input feature dimension
    out_channels : output feature dimension
    use_attention: if True, learn per-hyperedge attention weights
    """

    def __init__(self, in_channels: int, out_channels: int, use_attention: bool = False):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.use_attention = use_attention
        self.weight = nn.Linear(in_channels, out_channels, bias=True)
        if use_attention:
            self.attn = nn.Linear(out_channels, 1, bias=False)

    def forward(
        self,
        x: "torch.Tensor",           # (N, in_channels)
        H: "torch.Tensor",           # (N, M) incidence matrix
        W: Optional["torch.Tensor"] = None,  # (M,) hyperedge weights
    ) -> "torch.Tensor":             # (N, out_channels)
        N, M = H.shape

        # Default uniform hyperedge weights
        if W is None:
            W = torch.ones(M, device=x.device)

        # D_e: hyperedge degree (M,)
        D_e = H.sum(dim=0).clamp(min=1.0)

        # D_v: weighted node degree (N,)
        D_v = (H * W.unsqueeze(0)).sum(dim=1).clamp(min=1.0)

        # Propagation: H W D_e^{-1} H^T x
        # Step 1: H^T x → (M, in_channels)
        msg = H.t() @ x                               # (M, in_channels)
        # Step 2: D_e^{-1} scaling
        msg = msg / D_e.unsqueeze(1)                  # (M, in_channels)
        # Step 3: W scaling
        msg = msg * W.unsqueeze(1)                    # (M, in_channels)
        # Step 4: H aggregation back to nodes → (N, in_channels)
        agg = H @ msg                                 # (N, in_channels)
        # Step 5: D_v^{-1} scaling
        agg = agg / D_v.unsqueeze(1)                  # (N, in_channels)

        # Linear transform Θ
        out = self.weight(agg)                        # (N, out_channels)

        if self.use_attention:
            # Compute per-node attention gate
            gate = torch.sigmoid(self.attn(out))      # (N, 1)
            out = out * gate

        return F.elu(out)


# =============================================================================
# HCLNet Model
# =============================================================================

class HCLNet(nn.Module):  # type: ignore[misc]
    """
    Hypergraph Contrastive Learning Network.

    Encoder: 3 × HypergraphConv layers
    Projection head: 2-layer MLP for contrastive training
    """

    def __init__(
        self,
        in_channels: int = 16,
        hidden_channels: int = 64,
        out_channels: int = 32,
        proj_dim: int = 16,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.conv1 = HypergraphConv(in_channels, hidden_channels, use_attention=True)
        self.conv2 = HypergraphConv(hidden_channels, hidden_channels)
        self.conv3 = HypergraphConv(hidden_channels, out_channels)
        self.dropout = nn.Dropout(dropout)

        # Projection head for contrastive loss
        self.proj = nn.Sequential(
            nn.Linear(out_channels, hidden_channels),
            nn.ReLU(),
            nn.Linear(hidden_channels, proj_dim),
        )

    def encode(
        self,
        x: "torch.Tensor",
        H: "torch.Tensor",
        W: Optional["torch.Tensor"] = None,
    ) -> "torch.Tensor":
        """Return node embeddings (N, out_channels)."""
        z = self.conv1(x, H, W)
        z = self.dropout(z)
        z = self.conv2(z, H, W)
        z = self.dropout(z)
        z = self.conv3(z, H, W)
        return z

    def forward(
        self,
        x: "torch.Tensor",
        H: "torch.Tensor",
        W: Optional["torch.Tensor"] = None,
    ) -> Tuple["torch.Tensor", "torch.Tensor"]:
        """Return (embeddings, projections)."""
        z = self.encode(x, H, W)
        p = self.proj(z)
        return z, p


# =============================================================================
# NT-Xent Contrastive Loss
# =============================================================================

class NTXentLoss(nn.Module):  # type: ignore[misc]
    """
    Normalized Temperature-scaled Cross Entropy loss.
    Used for self-supervised contrastive training of HCLNet.

    For each node i, the positive pair is the same node's embedding
    from a differently-augmented view of the hypergraph.
    """

    def __init__(self, temperature: float = 0.5):
        super().__init__()
        self.temperature = temperature

    def forward(
        self,
        z1: "torch.Tensor",  # (N, dim) — view 1 projections
        z2: "torch.Tensor",  # (N, dim) — view 2 projections
    ) -> "torch.Tensor":
        N = z1.size(0)
        z = torch.cat([z1, z2], dim=0)                # (2N, dim)
        z = F.normalize(z, dim=1)
        sim = torch.mm(z, z.t()) / self.temperature   # (2N, 2N)

        # Mask out self-similarity
        mask = torch.eye(2 * N, dtype=torch.bool, device=z.device)
        sim.masked_fill_(mask, float("-inf"))

        # Positive pairs: (i, i+N) and (i+N, i)
        labels = torch.cat([
            torch.arange(N, 2 * N, device=z.device),
            torch.arange(0, N, device=z.device),
        ])
        loss = F.cross_entropy(sim, labels)
        return loss


# =============================================================================
# Hypergraph Augmentation
# =============================================================================

def augment_hypergraph(
    H: "torch.Tensor",
    drop_rate: float = 0.2,
) -> "torch.Tensor":
    """
    Randomly drop hyperedges to create an augmented view.
    Used during contrastive training.
    """
    M = H.size(1)
    keep = torch.rand(M, device=H.device) > drop_rate
    H_aug = H[:, keep]
    if H_aug.size(1) == 0:
        return H  # safety: never drop all hyperedges
    return H_aug


# =============================================================================
# HCLNet Predictor (inference wrapper)
# =============================================================================

class HCLNetPredictor:
    """
    Inference wrapper around HCLNet.

    Loads pre-trained model from models/m06_hclnet.pt if present.
    Falls back to Louvain community-based rule scoring when model absent.

    Fraud prototypes are stored as centroid embeddings of known-fraud
    entity clusters. Distance to nearest prototype = fraud probability.
    """

    # Fraud prototype labels stored alongside model
    PROTOTYPE_LABELS = [
        "shell_company",
        "related_party",
        "country_routing",
        "split_shipment",
        "hsn_ring",
    ]

    def __init__(self, in_channels: int = 16):
        self._model: Optional[HCLNet] = None
        self._prototypes: Optional["torch.Tensor"] = None
        self._in_channels = in_channels
        self._load()

    def _load(self) -> None:
        if not _TORCH_AVAILABLE:
            return
        model_path = Path(__file__).parent / "models" / "m06_hclnet.pt"
        if not model_path.exists():
            return
        try:
            checkpoint = torch.load(str(model_path), map_location="cpu", weights_only=False)
            model = HCLNet(in_channels=self._in_channels)
            model.load_state_dict(checkpoint["model_state"])
            model.eval()
            self._model = model
            if "prototypes" in checkpoint:
                self._prototypes = checkpoint["prototypes"]
            logger.info("[HCLNet] Model loaded from %s", model_path)
        except Exception as exc:
            logger.warning("[HCLNet] Failed to load model: %s — using rule-based fallback", exc)

    def predict(
        self,
        node_features: np.ndarray,       # (N, in_channels)
        incidence_matrix: np.ndarray,    # (N, M) sparse 0/1
        node_ids: List[str],             # entity IDs matching rows
        community_sizes: Dict[str, int], # node_id → community size from Louvain
    ) -> Dict[str, float]:
        """
        Returns per-node fraud score (0–100).

        Parameters
        ----------
        node_features    : feature matrix for all nodes
        incidence_matrix : hypergraph incidence matrix
        node_ids         : entity identifiers aligned with matrix rows
        community_sizes  : Louvain community size per node (used in fallback)

        Returns
        -------
        {node_id: score_0_to_100}
        """
        if self._model is not None and _TORCH_AVAILABLE:
            return self._nn_predict(node_features, incidence_matrix, node_ids)
        return self._rule_predict(node_ids, community_sizes, node_features)

    def _nn_predict(
        self,
        node_features: np.ndarray,
        incidence_matrix: np.ndarray,
        node_ids: List[str],
    ) -> Dict[str, float]:
        """Run HCLNet inference and score via prototype distance."""
        try:
            x = torch.tensor(node_features, dtype=torch.float32)
            H = torch.tensor(incidence_matrix, dtype=torch.float32)
            with torch.no_grad():
                z, _ = self._model(x, H)  # (N, out_channels)
                z_norm = F.normalize(z, dim=1)

            if self._prototypes is not None:
                p_norm = F.normalize(self._prototypes, dim=1)
                # cosine similarity to each prototype, take max
                sim = torch.mm(z_norm, p_norm.t())  # (N, P)
                max_sim, _ = sim.max(dim=1)          # (N,)
                scores = (max_sim.clamp(0, 1) * 100).tolist()
            else:
                # No prototypes: use embedding norm as proxy (untrained model)
                norms = z_norm.norm(dim=1)
                scores = (norms / norms.max().clamp(min=1e-6) * 50).tolist()

            return {nid: round(float(s), 1) for nid, s in zip(node_ids, scores)}
        except Exception as exc:
            logger.warning("[HCLNet] Inference failed: %s", exc)
            return {nid: 0.0 for nid in node_ids}

    def _rule_predict(
        self,
        node_ids: List[str],
        community_sizes: Dict[str, int],
        node_features: np.ndarray,
    ) -> Dict[str, float]:
        """
        Rule-based network fraud score when HCLNet model is absent.

        Heuristic: nodes in large communities with high feature variance
        (many different trade partners, unusual value patterns) score higher.
        """
        scores: Dict[str, float] = {}
        feat = node_features if node_features is not None else np.zeros((len(node_ids), 1))

        for i, nid in enumerate(node_ids):
            score = 0.0
            # Community size signal: large communities → potential shell ring
            c_size = community_sizes.get(nid, 1)
            if c_size >= 10:
                score += 40.0
            elif c_size >= 5:
                score += 20.0
            elif c_size >= 3:
                score += 10.0

            # Feature-based signals
            if feat.shape[1] > 0:
                row = feat[i]
                # High degree (many connections) in a small entity → suspicious
                if row[0] > 0 and row[0] > np.percentile(feat[:, 0], 90):
                    score += 20.0
                # Flag feature (index 1 = country risk, index 3 = ECOD anomaly)
                if feat.shape[1] > 1 and row[1] > 0.5:
                    score += 15.0
                if feat.shape[1] > 3 and row[3] > 0.5:
                    score += 10.0

            scores[nid] = min(round(score, 1), 100.0)

        return scores

    @property
    def model_used(self) -> str:
        return "hclnet" if self._model is not None else "rule_based"


# Module-level singleton — loaded once at import time
_PREDICTOR: Optional[HCLNetPredictor] = None


def get_predictor() -> HCLNetPredictor:
    """Return the module-level HCLNet predictor (lazy singleton)."""
    global _PREDICTOR
    if _PREDICTOR is None:
        _PREDICTOR = HCLNetPredictor()
    return _PREDICTOR
