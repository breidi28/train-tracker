import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime

url = "https://mersultrenurilor.infofer.ro/ro-RO/Statie/Bucuresti-Nord"
session = requests.Session()
r = session.get(url, headers={'User-Agent': 'Mozilla/5.0'})
soup = BeautifulSoup(r.content, 'html.parser')

form_data = {}
for field in ['Date', 'StationName', 'ReCaptcha', 'ConfirmationKey', '__RequestVerificationToken']:
    input_field = soup.find('input', {'name': field}) or soup.find('input', {'id': field})
    if input_field:
        form_data[field] = input_field.get('value', '')

# These are also needed
form_data['IsSearchWanted'] = 'True' # Set to true to get results
form_data['IsReCaptchaFailed'] = 'False'

result_url = "https://mersultrenurilor.infofer.ro/ro-RO/Stations/StationsResult"
headers = {
    'User-Agent': 'Mozilla/5.0',
    'Referer': url,
    'X-Requested-With': 'XMLHttpRequest'
}

print(f"POSTing to {result_url} with data: {form_data}")
res = session.post(result_url, data=form_data, headers=headers)
print(f"Status: {res.status_code}")

with open('infofer_res.html', 'w', encoding='utf-8') as f:
    f.write(res.text)

print(f"Saved response to infofer_res.html. Length: {len(res.text)}")
if 'IR 1621' in res.text:
    print("Found IR 1621 in results!")
else:
    print("IR 1621 not found.")
