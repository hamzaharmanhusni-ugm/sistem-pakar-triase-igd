"""Hitung statistik agregat MC-MED untuk kb/evidence.ttl (hanya angka agregat, aman dibagikan).
Pemakaian: python -I kb/build_evidence.py [path visits.csv]   (butuh pandas)
Bawaan: data/raw/mc-med-1.0.0/visits.csv (folder data/ di-gitignore karena berlisensi PhysioNet credentialed)."""
import sys
from pathlib import Path
import pandas as pd

SRC = sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'data' / 'raw' / 'mc-med-1.0.0' / 'visits.csv'
df = pd.read_csv(SRC, low_memory=False,
                 usecols=['Triage_acuity', 'ED_dispo', 'DC_dispo', 'Triage_HR', 'Triage_RR', 'Triage_SpO2'])
df['esi'] = df.Triage_acuity.str.extract(r'^(\d)')[0].astype(float)
df['adm'] = df.ED_dispo.isin(['Inpatient', 'ICU'])
df['crit'] = (df.ED_dispo == 'ICU') | (df.DC_dispo == 'Expired')
print(df.dropna(subset=['esi']).groupby('esi').agg(visits=('adm', 'size'), admitRate=('adm', 'mean'), criticalRate=('crit', 'mean')).round(4))
d = df[df.esi >= 3].copy()
d['dz'] = (d.Triage_HR > 100) | (d.Triage_RR > 20) | (d.Triage_SpO2 < 92)
print(d.groupby('dz').agg(visits=('adm', 'size'), admitRate=('adm', 'mean'), criticalRate=('crit', 'mean')).round(4))
