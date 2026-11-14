"""Fetch launch mass, nominal power, launch vehicle and date for real spacecraft
from NASA's NSSDCA Master Catalog. Output: src/data/nssdca.json (with source URLs)."""
import json, re, html, ssl, sys, urllib.request
IDS = {
 "juno":"2011-040A","kepler":"2009-011A","galileo":"1989-084B","dawn":"2007-043A",
 "new-horizons":"2006-001A","mro":"2005-029A","messenger":"2004-030A","maven":"2013-063A",
 "lro":"2009-031A","cassini":"1997-061A","mars-odyssey":"2001-014A","mgs":"1996-062A",
 "stardust":"1999-003A","deep-impact":"2005-001A","osiris-rex":"2016-055A",
 "lunar-prospector":"1998-001A","grail-a":"2011-046A","ladee":"2013-047A","insight":"2018-042A",
 "mco":"1998-073A","lucy":"2021-093A","psyche":"2023-157A","tess":"2018-038A",
 "spitzer":"2003-038A","near":"1996-008A","clementine":"1994-004A","voyager-1":"1977-084A",
 "wise":"2009-071A","swift":"2004-047A","mars-pathfinder":"1996-068A"}
ctx = ssl._create_unverified_context()
out = {}
for key, nid in IDS.items():
    url = f"https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id={nid}"
    try:
        t = urllib.request.urlopen(url, context=ctx, timeout=30).read().decode("utf8", "ignore")
    except Exception as e:
        print(key, "ERR", e, file=sys.stderr); continue
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t))).replace("\xa0", " ")
    def grab(label, pat=r"([^A-Z]{1,40})"):
        m = re.search(label + r":\s*" + pat, t)
        return m.group(1).strip() if m else None
    name = re.search(r"NSSDCA/COSPAR ID: " + re.escape(nid), t)
    title = re.search(r"Spacecraft - Details\s*(.*?)\s*NSSDCA/COSPAR ID", t)
    rec = {"nssdca_id": nid, "name": title.group(1).strip() if title else key,
           "launch_date": grab("Launch Date", r"(\d{4}-\d{2}-\d{2})"),
           "launch_vehicle": grab("Launch Vehicle", r"(.*?) Launch Site"),
           "mass_kg": grab("Mass", r"([\d,\.]+) ?kg"),
           "power_w": grab("Nominal Power", r"([\d,\.]+) ?W"),
           "source": url}
    for k in ("mass_kg", "power_w"):
        if rec[k]: rec[k] = float(rec[k].replace(",", ""))
    out[key] = rec
    print(key, rec["name"], rec["mass_kg"], rec["power_w"], rec["launch_vehicle"])
json.dump(out, open(sys.argv[1], "w"), indent=1)
