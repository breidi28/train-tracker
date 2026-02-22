
import requests
from bs4 import BeautifulSoup
import re

train_id = "1631"
url = f"https://mersultrenurilor.infofer.ro/ro-RO/Tren/{train_id}"
response = requests.get(url, timeout=10)
soup = BeautifulSoup(response.content, 'html.parser')

# Grep for "Operator" case-insensitively in all tags
print("Searching for 'Operator' in tags...")
for tag in soup.find_all(True):
    if tag.string and 'Operator' in tag.string:
        print(f"Found in {tag.name}: '{tag.string.strip()}'")
    elif tag.get_text() and 'Operator' in tag.get_text() and len(tag.get_text()) < 100:
        print(f"Found in {tag.name} (text): '{tag.get_text(strip=True)}'")

# Specifically look for common patterns in Romanian sites
for label in ['Operator feroviar', 'Operator', 'Compania']:
    element = soup.find(string=lambda x: x and label in x)
    if element:
        print(f"Match for label '{label}': '{element.strip()}' in parent <{element.parent.name}>")
        # Print content of siblings or parent
        print(f"Parent content: {element.parent.get_text(strip=True)}")
