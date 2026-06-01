import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
MIS_XLSX = ROOT / "Data MIS" / "Raw data MIS.xlsx"
OUT_JSON = Path(__file__).resolve().parent / "mis_data_export.json"


def main():
    df = pd.read_excel(MIS_XLSX, sheet_name="data SQL", header=1)
    df = df[pd.to_numeric(df["Year"], errors="coerce").notna()].copy()
    rows = []
    for _, row in df.iterrows():
        rows.append(
            {
                "year": int(row["Year"]),
                "month": int(row["Month"]),
                "plant": str(row["Plant"]).strip(),
                "scope": str(row["Scope"]).strip(),
                "process": str(row["Process"]).strip(),
                "source": str(row["GHG Source"]).strip(),
                "unit": str(row["Unit"]).strip(),
                "consumption_qty": float(row["ConsumptionQty"] or 0),
                "mis_ef_3dp": float(row["New EF"] or 0),
                "mis_emission_kg": float(row["Emission Value"] or 0),
            }
        )
    OUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} MIS rows to {OUT_JSON}")


if __name__ == "__main__":
    main()
