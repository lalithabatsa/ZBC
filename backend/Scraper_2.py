import requests
from bs4 import BeautifulSoup
import os
import re
from datetime import datetime

URLS = {
    "LLDPE": "https://www.plastemart.com/polymer-pricelist/lldpe-reliance/3/9",
    "LDPE": "https://www.plastemart.com/polymer-pricelist/ldpe-reliance/1/9"
}

HEADERS = {
    "User-Agent": "Mozilla/5.0"
}

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "scraped_data")
os.makedirs(BASE_DIR, exist_ok=True)


def extract_all_dates_and_links(url):
    response = requests.get(url, headers=HEADERS)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    data = []

    # Find all links with xlsx/xls files
    links = soup.find_all("a", href=True)

    for link_tag in links:
        href = link_tag["href"]

        if ".xls" not in href and ".xlsx" not in href:
            continue

        # Filter for Reliance files specifically
        if "Reliance" not in href and "Reliance" not in link_tag.get_text():
            continue

        # Extract filename from path
        filename = href.split("/")[-1]

        # Try to extract date from filename (format: DD-MM-YYYY or DD-MM-YYYY-...)
        date_match = re.search(r'(\d{2})-(\d{2})-(\d{4})', filename)
        if not date_match:
            continue

        try:
            day, month, year = date_match.groups()
            date_obj = datetime.strptime(f"{day}-{month}-{year}", "%d-%m-%Y")
        except:
            continue

        # Make absolute URL if needed
        if href.startswith("/"):
            href = "https://www.plastemart.com" + href

        data.append((date_obj, href))

    if not data:
        raise Exception("No valid date-link pairs found!")

    return data


def get_latest_entry(url):
    data = extract_all_dates_and_links(url)

    # Sort by date descending
    data.sort(key=lambda x: x[0], reverse=True)

    latest_date, latest_link = data[0]

    formatted_date = latest_date.strftime("%Y-%m-%d")

    return latest_link, formatted_date


def download_file(url, path):
    response = requests.get(url, headers=HEADERS)
    response.raise_for_status()

    with open(path, "wb") as f:
        f.write(response.content)

    print(f"Downloaded: {path}")


def process_polymer(name, url):
    print(f"\nProcessing {name}...")

    polymer_dir = os.path.join(BASE_DIR, name)
    os.makedirs(polymer_dir, exist_ok=True)

    latest_link, date_str = get_latest_entry(url)

    print(f"Latest Date: {date_str}")
    print(f"Excel URL: {latest_link}")

    # Extract original filename from URL
    file_name = latest_link.split("/")[-1]
    save_path = os.path.join(polymer_dir, file_name)

    download_file(latest_link, save_path)


if __name__ == "__main__":
    for polymer, url in URLS.items():
        process_polymer(polymer, url)

    print("\nDone! True latest files downloaded.")