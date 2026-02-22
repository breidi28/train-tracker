
import requests
from bs4 import BeautifulSoup
import re

# Try a train that IS actually private to see the difference
train_id = "11631" # Softrans train
url = f"https://mersultrenurilor.infofer.ro/ro-RO/Tren/{train_id}"
response = requests.get(url, timeout=10)
soup = BeautifulSoup(response.content, 'html.parser')

print(f"--- Results for Train {train_id} ---")

# Look for text nodes that contain "Operator"
nodes = soup.find_all(string=re.compile(r'Operator', re.I))
for node in nodes:
    print(f"Node: '{node.strip()}' | Parent: <{node.parent.name} class='{node.parent.get('class')}'>")
    print(f"Parent Text: '{node.parent.get_text(strip=True)}'")

# Let's try to find potential companies directly
companies = ["S.N.T.F.C. CFR Calatori", "Softrans", "Astra Trans Carpatic", "Regio Calatori", "Transferoviar Calatori", "Interregional Calatori"]
for company in companies:
    match = soup.find(string=re.compile(company, re.I))
    if match:
        print(f"FOUND COMPANY: '{match.strip()}' in <{match.parent.name}>")

# List all small segments of text that might be labels
print("\nSmall segments of text (potential labels):")
for tag in soup.find_all(['span', 'div', 'p', 'li']):
    txt = tag.get_text(strip=True)
    if 0 < len(txt) < 50 and any(kw in txt for kw in ['Operator', 'Feroviar', 'S.N.T.F.C', 'S.R.L']):
        print(f"<{tag.name} class='{tag.get('class')}'>: {txt}")
