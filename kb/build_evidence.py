"""Hitung statistik agregat MC-MED untuk kb/evidence.ttl (hanya angka agregat, aman dibagikan).
Pemakaian: python -I kb/build_evidence.py "D:/.../mc-med-1.0.0/visits.csv"   (butuh pandas)"""
import sys
import pandas as pd

df = pd.read_csv(sys.argv[1], low_memory=False,
                 usecols=['Triage_acuity', 'ED_dispo', 'DC_dispo', 'Triage_HR', 'Triage_RR', 'Triage_SpO2'])
df['esi'] = df.Triage_acuity.str.extract(r'^(\d)')[0].astype(float)
df['adm'] = df.ED_dispo.isin(['Inpatient', 'ICU'])
df['crit'] = (df.ED_dispo == 'ICU') | (df.DC_dispo == 'Expired')
print(df.dropna(subset=['esi']).groupby('esi').agg(visits=('adm', 'size'), admitRate=('adm', 'mean'), criticalRate=('crit', 'mean')).round(4))
d = df[df.esi >= 3].copy()
d['dz'] = (d.Triage_HR > 100) | (d.Triage_RR > 20) | (d.Triage_SpO2 < 92)
print(d.groupby('dz').agg(visits=('adm', 'size'), admitRate=('adm', 'mean'), criticalRate=('crit', 'mean')).round(4))
