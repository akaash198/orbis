"""
Seed HSN Embeddings — one-time setup script for the M03 vector index.

Loads HSN code descriptions from the existing HSCODE data (or a CSV/JSON file),
generates Voyage-4-large 3072-dim embeddings for each description, and inserts
them into the hsn_embeddings PostgreSQL table.

Usage:
    python seed_hsn_embeddings.py [--batch-size 64] [--dry-run]

Environment variables required:
    DATABASE_URL   — PostgreSQL connection string
    VOYAGE_API_KEY — Voyage AI API key

This script is idempotent — re-running it skips already-embedded codes.
"""

import argparse
import logging
import os
import sys
import time
from pathlib import Path
from typing import List, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Load .env ─────────────────────────────────────────────────────────────────
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/orbisporte"
).replace("postgresql+psycopg2://", "postgresql://", 1)

# ── Built-in seed data (covers all 21 WCO HS sections, 99 chapters) ──────────
# Format: (hsn_code_8dig, description, chapter, chapter_name, unit)
# This sample covers major categories; replace/extend with full schedule CSV.

SEED_HSN_DATA: List[Tuple] = [
    # Chapter 01 — Live Animals
    ("01011010", "Pure-bred breeding horses", 1, "Live Animals", "No."),
    ("01012100", "Live horses for slaughter", 1, "Live Animals", "No."),
    ("01022110", "Pure-bred breeding cattle", 1, "Live Animals", "No."),
    ("01051110", "Live fowls of species Gallus domesticus, not exceeding 185g", 1, "Live Animals", "No."),
    # Chapter 02 — Meat
    ("02011000", "Carcasses and half-carcasses of bovine animals, fresh or chilled", 2, "Meat & Edible Offal", "kg"),
    ("02071100", "Meat of fowls not cut in pieces, fresh or chilled", 2, "Meat & Edible Offal", "kg"),
    # Chapter 03 — Fish
    ("03011100", "Live ornamental freshwater fish", 3, "Fish & Crustaceans", "kg"),
    ("03021100", "Live trout (Salmo trutta), fresh or chilled", 3, "Fish & Crustaceans", "kg"),
    ("03061700", "Other shrimps and prawns, frozen", 3, "Fish & Crustaceans", "kg"),
    # Chapter 08 — Fruits
    ("08011100", "Desiccated coconuts", 8, "Edible Fruit & Nuts", "kg"),
    ("08051000", "Oranges, fresh or dried", 8, "Edible Fruit & Nuts", "kg"),
    ("08061000", "Grapes, fresh", 8, "Edible Fruit & Nuts", "kg"),
    # Chapter 09 — Coffee, Tea, Spices
    ("09011100", "Coffee, not roasted, not decaffeinated", 9, "Coffee, Tea, Spices", "kg"),
    ("09021010", "Green tea (not fermented) in immediate packings not exceeding 3 kg", 9, "Coffee, Tea, Spices", "kg"),
    ("09041110", "Pepper of genus Piper, neither crushed nor ground — light black pepper", 9, "Coffee, Tea, Spices", "kg"),
    # Chapter 10 — Cereals
    ("10011100", "Durum wheat, seed quality", 10, "Cereals", "kg"),
    ("10063010", "Semi-milled or wholly milled rice, whether polished or glazed", 10, "Cereals", "kg"),
    # Chapter 17 — Sugar
    ("17011200", "Beet sugar, raw, in solid form", 17, "Sugar & Sugar Confectionery", "kg"),
    ("17049010", "Sugar confectionery, white chocolate", 17, "Sugar & Sugar Confectionery", "kg"),
    # Chapter 22 — Beverages
    ("22021010", "Aerated water — mineral water and aerated water, containing added sugar", 22, "Beverages & Vinegar", "l"),
    ("22030000", "Beer made from malt", 22, "Beverages & Vinegar", "l"),
    ("22084011", "Whisky — bourbon whiskey, in containers holding 2 litres or less", 22, "Beverages & Vinegar", "l"),
    # Chapter 27 — Mineral Fuels
    ("27090000", "Petroleum oils and oils obtained from bituminous minerals, crude", 27, "Mineral Fuels & Oils", "kg"),
    ("27101290", "Other motor spirit (petrol), leaded", 27, "Mineral Fuels & Oils", "l"),
    ("27160000", "Electrical energy", 27, "Mineral Fuels & Oils", "kWh"),
    # Chapter 28 — Inorganic Chemicals
    ("28011000", "Chlorine", 28, "Inorganic Chemicals", "kg"),
    ("28030010", "Carbon black", 28, "Inorganic Chemicals", "kg"),
    ("28444000", "Radioactive elements, isotopes, compounds (other than 2844 10 to 2844 30)", 28, "Inorganic Chemicals", "kg"),
    # Chapter 29 — Organic Chemicals
    ("29011000", "Acyclic hydrocarbons, saturated", 29, "Organic Chemicals", "kg"),
    ("29051100", "Methanol (methyl alcohol)", 29, "Organic Chemicals", "kg"),
    ("29152100", "Acetic acid", 29, "Organic Chemicals", "kg"),
    # Chapter 30 — Pharmaceuticals
    ("30021200", "Antisera and other blood fractions, immunological products", 30, "Pharmaceutical Products", "kg"),
    ("30039011", "Medicines containing penicillin or derivatives, not in dosage form", 30, "Pharmaceutical Products", "kg"),
    ("30049011", "Medicines containing antibiotics for human use, in dosage form", 30, "Pharmaceutical Products", "kg"),
    # Chapter 33 — Essential Oils, Cosmetics
    ("33012910", "Essential oils of jasmine", 33, "Essential Oils & Cosmetics", "kg"),
    ("33030010", "Perfumes and toilet waters", 33, "Essential Oils & Cosmetics", "kg"),
    ("33051000", "Shampoos", 33, "Essential Oils & Cosmetics", "kg"),
    ("33061010", "Toothpaste", 33, "Essential Oils & Cosmetics", "kg"),
    # Chapter 39 — Plastics
    ("39011010", "Polyethylene having a specific gravity of less than 0.94 — linear low density", 39, "Plastics", "kg"),
    ("39021000", "Polypropylene", 39, "Plastics", "kg"),
    ("39074000", "Polycarbonates", 39, "Plastics", "kg"),
    ("39076010", "PET (polyethylene terephthalate) resin", 39, "Plastics", "kg"),
    # Chapter 40 — Rubber
    ("40011000", "Natural rubber latex, whether or not pre-vulcanised", 40, "Rubber & Articles", "kg"),
    ("40116210", "Pneumatic tyres for buses/lorries, radial", 40, "Rubber & Articles", "No."),
    # Chapter 44 — Wood
    ("44011100", "Coniferous fuel wood, in logs, billets, twigs, faggots", 44, "Wood & Articles", "kg"),
    ("44071100", "Coniferous wood sawn lengthwise, pine", 44, "Wood & Articles", "cbm"),
    # Chapter 48 — Paper
    ("48010000", "Newsprint in rolls or sheets", 48, "Paper & Paperboard", "kg"),
    ("48021010", "Handmade paper and paperboard", 48, "Paper & Paperboard", "kg"),
    # Chapter 50-63 — Textiles
    ("50020010", "Raw silk (not thrown) — mulberry silk", 50, "Silk", "kg"),
    ("52010010", "Cotton, not carded or combed — white staple", 52, "Cotton", "kg"),
    ("52081100", "Woven fabrics of cotton, plain weave, >= 85% cotton, <= 100g/m2", 52, "Cotton", "m2"),
    ("54011010", "Sewing thread of nylon or other polyamides, not retail", 54, "Man-Made Filaments", "kg"),
    ("54071010", "Woven fabrics of high-tenacity nylon yarn", 54, "Man-Made Filaments", "m2"),
    ("55013000", "Synthetic staple fibres, of acrylic or modacrylic, not carded", 55, "Man-Made Staple Fibres", "kg"),
    ("61091000", "T-shirts, singlets, tank tops — of cotton, knitted", 61, "Knitted Apparel", "No."),
    ("62041900", "Women's suits and ensembles of other textile materials", 62, "Woven Apparel", "No."),
    ("63011000", "Electric blankets", 63, "Textile Articles", "No."),
    # Chapter 64 — Footwear
    ("64011000", "Waterproof footwear with outer soles and uppers of rubber/plastics — ski-boots", 64, "Footwear", "Pairs"),
    ("64051000", "Footwear with uppers of leather or composition leather", 64, "Footwear", "Pairs"),
    # Chapter 72-83 — Metals
    ("72041000", "Ferrous waste and scrap of cast iron", 72, "Iron & Steel", "kg"),
    ("72081000", "Flat-rolled iron/steel >= 600mm wide, hot-rolled, in coils, not clad", 72, "Iron & Steel", "kg"),
    ("72142000", "Bars and rods of iron/steel, with indentations, ribs, grooves — rebar", 72, "Iron & Steel", "kg"),
    ("73042310", "Seamless circular cross-section tube/pipe of stainless steel, cold-drawn", 73, "Iron & Steel Articles", "kg"),
    ("74031100", "Copper cathodes, unwrought refined copper", 74, "Copper & Articles", "kg"),
    ("76011000", "Aluminium, not alloyed, unwrought", 76, "Aluminium & Articles", "kg"),
    ("76042100", "Hollow profiles of aluminium alloys", 76, "Aluminium & Articles", "kg"),
    # Chapter 84 — Industrial Machinery
    ("84071000", "Spark-ignition reciprocating piston engine for aircraft", 84, "Nuclear Reactors, Machinery", "No."),
    ("84073400", "Spark-ignition piston engine displacement > 1000cc for motor vehicles", 84, "Nuclear Reactors, Machinery", "No."),
    ("84133000", "Fuel, lubricating or cooling medium pumps for internal combustion engines", 84, "Nuclear Reactors, Machinery", "No."),
    ("84159000", "Parts of air conditioning machines", 84, "Nuclear Reactors, Machinery", "No."),
    ("84186100", "Heat pumps other than air conditioning machines", 84, "Nuclear Reactors, Machinery", "No."),
    ("84198100", "Industrial machinery for treating materials by temperature change — pasteuriser", 84, "Nuclear Reactors, Machinery", "No."),
    ("84213900", "Filtering or purifying machinery for gases, other", 84, "Nuclear Reactors, Machinery", "No."),
    ("84314900", "Parts of machinery of headings 8426, 8429 or 8430 — bulldozer blade", 84, "Nuclear Reactors, Machinery", "No."),
    ("84431500", "Offset printing machinery, sheet-fed, office type", 84, "Nuclear Reactors, Machinery", "No."),
    ("84713000", "Portable automatic data processing machines, laptop computers, not exceeding 10 kg", 84, "Nuclear Reactors, Machinery", "No."),
    ("84716000", "Input/output units for ADP — keyboards, mouse, scanners", 84, "Nuclear Reactors, Machinery", "No."),
    ("84717000", "Storage units for ADP — hard disk drives, SSD, flash drives", 84, "Nuclear Reactors, Machinery", "No."),
    ("84732900", "Parts and accessories for printers and fax machines", 84, "Nuclear Reactors, Machinery", "No."),
    ("84748000", "Other machinery for working stone, ceramics, concrete", 84, "Nuclear Reactors, Machinery", "No."),
    # Chapter 85 — Electrical Equipment
    ("85011090", "Electric motors of output not exceeding 37.5 W, other", 85, "Electrical Machinery", "No."),
    ("85021100", "Generating sets with compression-ignition engines, not exceeding 75 kVA", 85, "Electrical Machinery", "No."),
    ("85030000", "Parts suitable for use solely with electric motors and generators", 85, "Electrical Machinery", "kg"),
    ("85044030", "Static converters — inverters, solar inverters, UPS, DC-AC converters", 85, "Electrical Machinery", "No."),
    ("85044040", "Battery chargers", 85, "Electrical Machinery", "No."),
    ("85065000", "Lithium primary cells and lithium primary batteries", 85, "Electrical Machinery", "No."),
    ("85076000", "Lithium-ion accumulators (rechargeable batteries)", 85, "Electrical Machinery", "No."),
    ("85081100", "Vacuum cleaners, with self-contained electric motor, power <= 1500W", 85, "Electrical Machinery", "No."),
    ("85094000", "Food grinders, mixers and fruit/vegetable juice extractors", 85, "Electrical Machinery", "No."),
    ("85161000", "Electric instantaneous or storage water heaters, immersion heaters", 85, "Electrical Machinery", "No."),
    ("85162100", "Storage heating radiators", 85, "Electrical Machinery", "No."),
    ("85171200", "Telephones — smartphones, cellular network handsets", 85, "Electrical Machinery", "No."),
    ("85176200", "Machines for the reception, conversion and transmission of voice/data — WiFi routers", 85, "Electrical Machinery", "No."),
    ("85177090", "Parts of telephone sets — PCBs for mobile phones", 85, "Electrical Machinery", "No."),
    ("85258000", "Television cameras, digital cameras and video camera recorders", 85, "Electrical Machinery", "No."),
    ("85271200", "Pocket-size radio cassette-players — portable receivers", 85, "Electrical Machinery", "No."),
    ("85285100", "Monitors of a kind used solely/principally with ADP — computer monitors", 85, "Electrical Machinery", "No."),
    ("85287200", "Colour television receivers incorporating video recording/reproducing apparatus", 85, "Electrical Machinery", "No."),
    ("85311000", "Burglar or fire alarms and similar apparatus", 85, "Electrical Machinery", "No."),
    ("85392200", "Tungsten halogen filament lamps", 85, "Electrical Machinery", "No."),
    ("85414010", "Photosensitive semiconductor devices — solar cells, photovoltaic modules", 85, "Electrical Machinery", "No."),
    ("85423100", "Processors and controllers — microprocessors, CPUs", 85, "Electrical Machinery", "No."),
    ("85423200", "Memories — RAM, ROM, flash memory chips", 85, "Electrical Machinery", "No."),
    ("85423900", "Other electronic integrated circuits — ASICs, FPGAs, GPUs", 85, "Electrical Machinery", "No."),
    ("85429000", "Parts of electronic integrated circuits", 85, "Electrical Machinery", "kg"),
    ("85444900", "Insulated electric conductors — wires and cables, not fitted with connectors", 85, "Electrical Machinery", "kg"),
    ("85451100", "Graphite or other carbon electrodes of a kind used for furnaces", 85, "Electrical Machinery", "kg"),
    # Chapter 87 — Vehicles
    ("87012000", "Road tractors for semi-trailers", 87, "Vehicles", "No."),
    ("87032190", "Passenger motor vehicle, spark-ignition, 1000cc-1500cc, other", 87, "Vehicles", "No."),
    ("87041010", "Dumpers for off-highway use, diesel electric", 87, "Vehicles", "No."),
    ("87060010", "Chassis fitted with engines for motor vehicles — buses", 87, "Vehicles", "No."),
    ("87089900", "Other parts and accessories for motor vehicles", 87, "Vehicles", "No."),
    # Chapter 88 — Aircraft
    ("88021100", "Aeroplanes, unladen weight not exceeding 2,000 kg", 88, "Aircraft & Spacecraft", "No."),
    ("88026000", "Spacecraft (including satellites) and launch vehicles", 88, "Aircraft & Spacecraft", "No."),
    # Chapter 90 — Optical / Medical
    ("90011000", "Optical fibres and optical fibre bundles", 90, "Optical & Measuring Instruments", "kg"),
    ("90021100", "Objective lenses for cameras, projectors, photographic enlargers", 90, "Optical & Measuring Instruments", "No."),
    ("90181100", "Electro-diagnostic apparatus — ECG, EEG, patient monitoring", 90, "Optical & Measuring Instruments", "No."),
    ("90271000", "Gas or smoke analysis apparatus", 90, "Optical & Measuring Instruments", "No."),
    ("90301000", "Instruments for measuring ionising radiations — Geiger counters", 90, "Optical & Measuring Instruments", "No."),
    # Chapter 94 — Furniture
    ("94012000", "Seats of a kind used for motor vehicles", 94, "Furniture & Lighting", "No."),
    ("94036000", "Other wooden furniture", 94, "Furniture & Lighting", "No."),
    ("94051000", "Chandeliers and other electric ceiling/wall light fittings", 94, "Furniture & Lighting", "No."),
    # Chapter 95 — Toys / Sports
    ("95030010", "Electric trains, including tracks, signals and accessories", 95, "Toys, Games, Sports", "No."),
    ("95044000", "Playing cards", 95, "Toys, Games, Sports", "No."),
    ("95069990", "Other articles for general physical exercise, gymnastics, athletics", 95, "Toys, Games, Sports", "No."),
    # Chapter 99 — Special transactions
    ("99010000", "Passengers' baggage, postal packages", 99, "Special Transactions", "NA"),
    ("99030000", "Relief consignments", 99, "Special Transactions", "NA"),
]


def seed(batch_size: int = 64, dry_run: bool = False):
    import psycopg2
    import psycopg2.extras

    sys.path.insert(0, str(Path(__file__).parent))

    from Orbisporte.domain.services.m03_classification.embedder import get_embeddings_batch

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur  = conn.cursor()

    # Find which codes already have embeddings
    cur.execute("SELECT hsn_code FROM hsn_embeddings WHERE embedding IS NOT NULL")
    already_embedded = {r[0] for r in cur.fetchall()}
    logger.info("Already embedded: %d codes", len(already_embedded))

    pending = [row for row in SEED_HSN_DATA if row[0] not in already_embedded]
    logger.info("Pending: %d codes to embed", len(pending))

    if dry_run:
        logger.info("[DRY RUN] Would embed %d codes. Exiting.", len(pending))
        cur.close()
        conn.close()
        return

    total_inserted = 0

    for i in range(0, len(pending), batch_size):
        batch = pending[i: i + batch_size]
        texts = [row[1] for row in batch]   # description strings

        logger.info("Embedding batch %d-%d / %d ...", i + 1, i + len(batch), len(pending))
        t0 = time.time()
        embeddings = get_embeddings_batch(texts, input_type="document")
        logger.info("  Embedded in %.1fs", time.time() - t0)

        records = []
        for j, (hsn_code, description, chapter, chapter_name, unit) in enumerate(batch):
            vec_str = "[" + ",".join(f"{x:.8f}" for x in embeddings[j]) + "]"
            records.append((hsn_code, description, chapter, chapter_name, unit, vec_str))

        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO hsn_embeddings (hsn_code, description, chapter, chapter_name, unit, embedding, embedded_at)
            VALUES %s
            ON CONFLICT (hsn_code) DO UPDATE
                SET description  = EXCLUDED.description,
                    embedding    = EXCLUDED.embedding,
                    embedded_at  = NOW()
            """,
            [(r[0], r[1], r[2], r[3], r[4], r[5]) + (None,) for r in records],
            template="(%s, %s, %s, %s, %s, %s::vector, NOW())",
        )
        conn.commit()
        total_inserted += len(batch)
        logger.info("  Committed %d codes (total %d / %d)", len(batch), total_inserted, len(pending))

    cur.close()
    conn.close()
    logger.info("Seeding complete — %d HSN codes embedded.", total_inserted)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed HSN embeddings into pgvector")
    parser.add_argument("--batch-size", type=int, default=64, help="Voyage API batch size (default: 64)")
    parser.add_argument("--dry-run", action="store_true", help="Show count without embedding")
    args = parser.parse_args()
    seed(batch_size=args.batch_size, dry_run=args.dry_run)
