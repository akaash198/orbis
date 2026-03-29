"""
Entity Hypergraph Builder  (SOP FRAUD-002)
==========================================
Builds and maintains the trade entity relationship hypergraph used by HCLNet
and Louvain community detection.

Nodes (entity types)
---------------------
  IMP  : Importer  (identified by IEC number)
  EXP  : Exporter  (name + country)
  CAR  : Carrier   (shipping line / airline)
  COO  : Country of origin
  HSN  : HSN code  (4-digit prefix)
  PRT  : Port      (ICEGATE port code)

Hyperedges
----------
Each shipment transaction creates one hyperedge connecting all entities
involved in that shipment.  Additional meta-edges are created for:
  - Shared address (two importers at same address → hyperedge)
  - Shared director (company → director → company hyperedge)

Incidence matrix H
------------------
H[i, j] = 1  if node i participates in hyperedge j
Shape: (N nodes) × (M hyperedges)

Node feature vector (16 dimensions)
------------------------------------
  0  : degree (number of hyperedges)
  1  : country_risk_flag
  2  : is_importer
  3  : ecod_anomaly_flag (set externally)
  4  : benford_flag
  5  : total_cif_inr (log-scaled)
  6  : shipment_count
  7  : unique_partner_count
  8  : hsn_diversity (unique HSN codes seen)
  9  : temporal_activity_score (recency-weighted)
  10–15: reserved / zero-padded

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# Optional NetworkX + community detection
try:
    import networkx as nx
    _NX_AVAILABLE = True
except ImportError:
    _NX_AVAILABLE = False
    logger.warning("[GraphBuilder] networkx not found — community detection disabled")

try:
    import community as community_louvain  # python-louvain
    _LOUVAIN_AVAILABLE = True
except ImportError:
    try:
        from community import community_louvain  # alternate import path
        _LOUVAIN_AVAILABLE = True
    except ImportError:
        _LOUVAIN_AVAILABLE = False
        logger.warning("[GraphBuilder] python-louvain not found — using degree-based community")

_FEAT_DIM = 16

# High-risk country set (mirrors predictor.py)
_HIGH_RISK_COUNTRIES: Set[str] = {"IRN", "PRK", "SYR", "MMR", "BLR", "RUS", "CUB", "VEN"}


class EntityNode:
    """A node in the trade entity graph."""

    __slots__ = (
        "node_id", "entity_type", "entity_value",
        "shipment_count", "total_cif_inr", "partners", "hsn_codes",
        "country_risk", "ecod_flag", "benford_flag",
        "last_seen_ts", "community_id",
    )

    def __init__(self, node_id: str, entity_type: str, entity_value: str):
        self.node_id = node_id
        self.entity_type = entity_type          # IMP/EXP/CAR/COO/HSN/PRT
        self.entity_value = entity_value
        self.shipment_count = 0
        self.total_cif_inr = 0.0
        self.partners: Set[str] = set()         # connected node IDs
        self.hsn_codes: Set[str] = set()
        self.country_risk = False
        self.ecod_flag = False
        self.benford_flag = False
        self.last_seen_ts = 0                   # Unix timestamp
        self.community_id = -1

    def to_feature_vector(self) -> np.ndarray:
        """Return 16-dim feature vector for HCLNet."""
        feat = np.zeros(_FEAT_DIM, dtype=np.float32)
        feat[0] = min(self.shipment_count / 100.0, 1.0)
        feat[1] = 1.0 if self.country_risk else 0.0
        feat[2] = 1.0 if self.entity_type == "IMP" else 0.0
        feat[3] = 1.0 if self.ecod_flag else 0.0
        feat[4] = 1.0 if self.benford_flag else 0.0
        feat[5] = min(math.log1p(self.total_cif_inr) / 20.0, 1.0)
        feat[6] = min(self.shipment_count / 50.0, 1.0)
        feat[7] = min(len(self.partners) / 20.0, 1.0)
        feat[8] = min(len(self.hsn_codes) / 10.0, 1.0)
        feat[9] = min(self.last_seen_ts / 1e9, 1.0)
        return feat


class HypergraphBuilder:
    """
    Incrementally builds the trade entity hypergraph from transaction data.

    Usage
    -----
    builder = HypergraphBuilder()
    builder.add_transaction(tx)        # called for each new/historical tx
    H, node_ids, features = builder.build_matrices()
    G = builder.to_networkx()
    communities = builder.detect_communities()
    """

    def __init__(self):
        self._nodes: Dict[str, EntityNode] = {}       # node_id → EntityNode
        self._hyperedges: List[Set[str]] = []          # list of node-ID sets
        self._edge_weights: List[float] = []           # per-hyperedge weight

    # ------------------------------------------------------------------
    # Node management
    # ------------------------------------------------------------------

    def _get_or_create(self, entity_type: str, entity_value: str) -> str:
        """Return node_id, creating the node if it doesn't exist."""
        node_id = f"{entity_type}:{entity_value}"
        if node_id not in self._nodes:
            node = EntityNode(node_id, entity_type, entity_value)
            if entity_type == "COO" and entity_value in _HIGH_RISK_COUNTRIES:
                node.country_risk = True
            self._nodes[node_id] = node
        return node_id

    # ------------------------------------------------------------------
    # Transaction ingestion
    # ------------------------------------------------------------------

    def add_transaction(
        self,
        tx: Dict[str, Any],
        ecod_anomaly: bool = False,
        benford_flag: bool = False,
    ) -> str:
        """
        Ingest one transaction and add a hyperedge for all entities involved.

        Returns the hyperedge index (as string) for reference.
        """
        # Build entity node IDs
        participants: Set[str] = set()

        iec = str(tx.get("importer_iec") or "").strip()
        if iec:
            nid = self._get_or_create("IMP", iec)
            participants.add(nid)
            node = self._nodes[nid]
            node.shipment_count += 1
            node.total_cif_inr += float(tx.get("cif_value_inr") or 0)
            if ecod_anomaly:
                node.ecod_flag = True
            if benford_flag:
                node.benford_flag = True

        exp_name = str(tx.get("exporter_name") or "").strip().upper()
        exp_country = str(tx.get("country_of_origin") or "").strip().upper()
        if exp_name:
            exp_key = f"{exp_name}_{exp_country}"
            nid = self._get_or_create("EXP", exp_key)
            participants.add(nid)
            self._nodes[nid].shipment_count += 1
            self._nodes[nid].total_cif_inr += float(tx.get("cif_value_inr") or 0)

        carrier = str(tx.get("shipping_line") or "").strip().upper()
        if carrier:
            nid = self._get_or_create("CAR", carrier)
            participants.add(nid)
            self._nodes[nid].shipment_count += 1

        coo = str(tx.get("country_of_origin") or "").strip().upper()
        if coo:
            nid = self._get_or_create("COO", coo)
            participants.add(nid)
            self._nodes[nid].shipment_count += 1

        hsn = str(tx.get("hsn_code") or "").strip()[:4]
        if hsn:
            nid = self._get_or_create("HSN", hsn)
            participants.add(nid)
            self._nodes[nid].shipment_count += 1

        port = str(tx.get("port_of_import") or "").strip().upper()
        if port:
            nid = self._get_or_create("PRT", port)
            participants.add(nid)

        # Register partners (pairwise) for NetworkX graph
        p_list = list(participants)
        for i, a in enumerate(p_list):
            for b in p_list[i + 1:]:
                self._nodes[a].partners.add(b)
                self._nodes[b].partners.add(a)

        # Update HSN sets for importers/exporters
        if hsn and iec:
            imp_id = f"IMP:{iec}"
            if imp_id in self._nodes:
                self._nodes[imp_id].hsn_codes.add(hsn)

        # Add hyperedge if we have at least 2 participants
        if len(participants) >= 2:
            # Weight = log(CIF) as a proxy for importance
            cif = float(tx.get("cif_value_inr") or 1)
            weight = float(math.log1p(cif))
            self._hyperedges.append(participants)
            self._edge_weights.append(weight)

        return str(len(self._hyperedges) - 1)

    # ------------------------------------------------------------------
    # Matrix construction
    # ------------------------------------------------------------------

    def build_matrices(self) -> Tuple[np.ndarray, List[str], np.ndarray]:
        """
        Build and return (H, node_ids, node_features).

        H           : incidence matrix (N × M), float32
        node_ids    : list of node_id strings
        node_features : feature matrix (N × 16), float32
        """
        node_ids = list(self._nodes.keys())
        N = len(node_ids)
        M = len(self._hyperedges)

        if N == 0 or M == 0:
            return (
                np.zeros((0, 0), dtype=np.float32),
                [],
                np.zeros((0, _FEAT_DIM), dtype=np.float32),
            )

        node_idx = {nid: i for i, nid in enumerate(node_ids)}

        H = np.zeros((N, M), dtype=np.float32)
        for j, edge_nodes in enumerate(self._hyperedges):
            for nid in edge_nodes:
                if nid in node_idx:
                    H[node_idx[nid], j] = 1.0

        # Update degree in node objects
        for nid, node in self._nodes.items():
            i = node_idx[nid]
            node_degree = int(H[i].sum())

        features = np.vstack([
            self._nodes[nid].to_feature_vector() for nid in node_ids
        ])

        return H, node_ids, features

    def get_edge_weights(self) -> np.ndarray:
        return np.array(self._edge_weights, dtype=np.float32)

    # ------------------------------------------------------------------
    # NetworkX graph (for Louvain)
    # ------------------------------------------------------------------

    def to_networkx(self) -> Optional[Any]:
        """Convert to a weighted NetworkX graph for Louvain community detection."""
        if not _NX_AVAILABLE:
            return None
        G = nx.Graph()
        for nid, node in self._nodes.items():
            G.add_node(nid, entity_type=node.entity_type,
                       cif=node.total_cif_inr, count=node.shipment_count)

        for edge_nodes, weight in zip(self._hyperedges, self._edge_weights):
            p_list = list(edge_nodes)
            for i, a in enumerate(p_list):
                for b in p_list[i + 1:]:
                    if G.has_edge(a, b):
                        G[a][b]["weight"] += weight
                    else:
                        G.add_edge(a, b, weight=weight)
        return G

    # ------------------------------------------------------------------
    # Community detection
    # ------------------------------------------------------------------

    def detect_communities(self) -> Dict[str, int]:
        """
        Run Louvain community detection.
        Returns {node_id: community_id}.
        """
        G = self.to_networkx()
        if G is None or G.number_of_nodes() == 0:
            return {nid: 0 for nid in self._nodes}

        if _LOUVAIN_AVAILABLE:
            try:
                partition = community_louvain.best_partition(G, weight="weight")
                for nid, cid in partition.items():
                    if nid in self._nodes:
                        self._nodes[nid].community_id = cid
                return partition
            except Exception as exc:
                logger.warning("[GraphBuilder] Louvain failed: %s", exc)

        # Fallback: connected components as communities
        partition = {}
        for cid, component in enumerate(nx.connected_components(G)):
            for nid in component:
                partition[nid] = cid
                if nid in self._nodes:
                    self._nodes[nid].community_id = cid
        return partition

    def get_community_sizes(self, partition: Dict[str, int]) -> Dict[str, int]:
        """Return {node_id: size_of_its_community}."""
        from collections import Counter
        cid_counts = Counter(partition.values())
        return {nid: cid_counts[cid] for nid, cid in partition.items()}

    # ------------------------------------------------------------------
    # Shared-attribute hyperedges
    # ------------------------------------------------------------------

    def add_shared_attribute_edges(
        self,
        importer_attributes: List[Dict[str, Any]],
    ) -> None:
        """
        Add hyperedges for importers sharing the same address or director,
        which is a strong shell-company signal.

        importer_attributes: list of {iec, address, director_name}
        """
        address_groups: Dict[str, List[str]] = defaultdict(list)
        director_groups: Dict[str, List[str]] = defaultdict(list)

        for entry in importer_attributes:
            iec = str(entry.get("iec") or "").strip()
            addr = str(entry.get("address") or "").strip().upper()[:60]
            director = str(entry.get("director_name") or "").strip().upper()

            if not iec:
                continue

            nid = f"IMP:{iec}"
            if addr and len(addr) > 10:
                address_groups[addr].append(nid)
            if director and len(director) > 3:
                director_groups[director].append(nid)

        for addr, nids in address_groups.items():
            if len(nids) >= 2:
                participants = set(nids)
                self._hyperedges.append(participants)
                self._edge_weights.append(50.0)  # High weight — strong signal

        for director, nids in director_groups.items():
            if len(nids) >= 2:
                participants = set(nids)
                self._hyperedges.append(participants)
                self._edge_weights.append(60.0)  # Even stronger signal

    @property
    def node_count(self) -> int:
        return len(self._nodes)

    @property
    def edge_count(self) -> int:
        return len(self._hyperedges)

    def get_node(self, node_id: str) -> Optional[EntityNode]:
        return self._nodes.get(node_id)

    def to_summary(self) -> Dict[str, Any]:
        return {
            "node_count"       : self.node_count,
            "hyperedge_count"  : self.edge_count,
            "importer_count"   : sum(1 for n in self._nodes.values() if n.entity_type == "IMP"),
            "exporter_count"   : sum(1 for n in self._nodes.values() if n.entity_type == "EXP"),
            "high_risk_nodes"  : sum(1 for n in self._nodes.values() if n.country_risk),
            "ecod_flagged_nodes": sum(1 for n in self._nodes.values() if n.ecod_flag),
        }
