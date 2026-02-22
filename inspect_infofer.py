
import requests
from bs4 import BeautifulSoup
import re

train_id = "1631" # A CFR train
url = f"https://mersultrenurilor.infofer.ro/ro-RO/Tren/{train_id}"
response = requests.get(url, timeout=10)
soup = BeautifulSoup(response.content, 'html.parser')

# Find the label "Operator:" or similar
operator_label = soup.find(text=re.compile(r'Operator', re.I))
if operator_label:
    parent = operator_label.parent
    print(f"Label found: '{operator_label.strip()}'")
    print(f"Parent tag: {parent.name}")
    print(f"Parent text content: '{parent.get_text(strip=True)}'")
    
    # Try to find the value next to it
    # Often it's structured like: <div><span>Operator:</span> <span>CFR Calatori</span></div>
    # or it's just text in the parent.
    siblings = operator_label.find_next_siblings()
    if siblings:
        print(f"Siblings found: {[s.get_text(strip=True) for s in siblings]}")
    
    # Try finding by looking for the next text node
    next_node = operator_label.find_next(text=True)
    if next_node:
        print(f"Next text node: '{next_node.strip()}'")

# Look specifically for the div that might contain technical details
tech_details = soup.find('div', class_='train-details') or soup.find('div', id='div-train-details')
if tech_details:
    print(f"Found train details div!")
    print(tech_details.get_text(separator=' | ', strip=True))
else:
    # Print all summary-like text to find where operator is hidden
    print("\nPage Summary Text Snippets:")
    for div in soup.find_all(['div', 'li', 'span'], class_=re.compile(r'detail|summary|info|header', re.I)):
        txt = div.get_text(strip=True)
        if 'Operator' in txt:
            print(f"Match in class '{div.get('class')}': {txt}")
