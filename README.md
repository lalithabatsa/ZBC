# Material Price Explorer

A web application for exploring and managing material pricing data from Reliance polymers (LDPE, LLDPE). The application scrapes the latest pricing information from Plastemart and provides an interactive interface to search and update prices.

## 📋 Features

- **Web-based UI**: Clean, modern interface for browsing material prices
- **Automated Scraping**: Fetches latest pricing data from Plastemart
- **Price Search**: Filter by material, state, pricing zone, and grade
- **Price Editing**: Update prices directly in Excel files
- **Source Tracking**: View metadata about price sources (file, sheet, cell reference)
- **Cascading Filters**: Dynamic dropdown updates based on selections

## 📁 Project Structure

```
Material-Price-Explorer/
├── backend/
│   ├── app.py              # FastAPI server with API endpoints
│   ├── Scraper.py          # Web scraper for downloading latest prices
│   └── Scraper_2.py        # Alternative scraper implementation
├── frontend/
│   ├── index.html          # Main web interface
│   ├── main.js             # Frontend logic and UI interactions
│   └── style.css           # Styling and layout
├── data/
│   ├── pricing_info/       # Storage for manually added Excel files
│   └── scraped_data/       # Downloaded pricing files
│       ├── LDPE/           # Low-Density Polyethylene data
│       └── LLDPE/          # Linear Low-Density Polyethylene data
├── archive/
│   └── reliance-price-app(copy).html  # Backup/old files
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Python 3.7+
- pip (Python package manager)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rahulbalhotra/Material-Price-Explorer.git
   cd Material-Price-Explorer
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   cd backend
   python -m uvicorn app:app --reload
   ```

   The application will start at `http://localhost:8000`

### Running the Scraper

To download the latest pricing data:

```bash
cd backend
python Scraper_2.py
```

This will:
- Connect to Plastemart.com
- Find the latest pricing files for LDPE and LLDPE
- Parse dates from filenames and download the most recent
- Save files to `data/scraped_data/{POLYMER_TYPE}/`

## 📖 Usage

### Web Interface

1. Open `http://localhost:8000` in your browser
2. Select a material category (LDPE, LLDPE, etc.)
3. Choose your desired state, pricing zone, and material grade
4. View the current price in Rs./MT
5. Hover over the info icon (?) to see source details

### Editing Prices

1. Click the edit icon (✎) next to a price
2. Enter the new price
3. Click "Save" to update the Excel file
4. The price updates immediately in the application

### Adding Manual Pricing Files

Place Excel files in `data/pricing_info/` with the following structure:
- Sheet name: "ex-works"
- Columns: Sr.No., Pricing Zone, State, Material Grade(s)
- Include metadata line with format: "Date : DD Month YYYY Ref : ... Domestic Prices for MATERIAL ..."

## 🔧 API Endpoints

### GET `/api/data`
Returns all pricing data from Excel files

**Response:**
```json
[
  {
    "material": "HDPE",
    "state": "Gujarat",
    "zone": "Hazira",
    "grade": "HDPE Film Grade",
    "price": 95.50,
    "meta": {
      "source_file": "01-01-2026-PE-Reliance.xlsx",
      "sheet": "ex-works",
      "cell_ref": "D15",
      "date": "01 January 2026"
    }
  }
]
```

### POST `/api/update-price`
Updates a price in an Excel file

**Request Body:**
```json
{
  "filename": "01-01-2026-PE-Reliance.xlsx",
  "sheet": "ex-works",
  "cell_ref": "D15",
  "new_price": 95.75
}
```

## 📦 Dependencies

- **FastAPI**: Web framework for building APIs
- **BeautifulSoup4**: Web scraping library
- **Requests**: HTTP library for web requests
- **Pandas**: Data manipulation and Excel file reading
- **Openpyxl**: Excel file manipulation
- **Uvicorn**: ASGI server for FastAPI

Install with: `pip install fastapi uvicorn beautifulsoup4 requests pandas openpyxl`

## 🔄 Workflow

### For End Users:
1. Run Scraper.py to get latest data
2. Start the FastAPI server
3. Access the web UI
4. Search and view prices
5. Optionally edit prices (saves to Excel)

### For Developers:
1. Modify scrapers to adjust data sources
2. Update frontend UI by editing frontend/* files
3. Add API endpoints in backend/app.py
4. Run tests and commit changes

## 📝 File Descriptions

| File | Purpose |
|------|---------|
| `backend/app.py` | FastAPI application and route handlers |
| `backend/Scraper.py` | Main web scraper (extracts dates from filenames) |
| `backend/Scraper_2.py` | Alternative scraper (for date parsing from HTML) |
| `frontend/index.html` | HTML structure and layout |
| `frontend/main.js` | JavaScript for UI interactions and API calls |
| `frontend/style.css` | CSS styling and responsive design |

## 🐛 Troubleshooting

### Scraper not finding files
- Check that URLs in `URLS` dictionary are correct
- Verify internet connection and Plastemart.com accessibility
- Check if website HTML structure has changed

### Excel parsing errors
- Ensure Excel files have "ex-works" sheet (case-insensitive)
- Verify data format matches expected structure
- Check for special characters in filenames

### Price update fails
- Ensure the cell reference (e.g., "D15") is valid
- Verify file exists in the specified path
- Check file permissions

## 🤝 Contributing

1. Create a branch for your changes
2. Make improvements to scrapers or UI
3. Test thoroughly
4. Submit a pull request

## 📄 License

This project is part of the Material Price Explorer initiative.

## ✉️ Contact

For issues or questions, please create an issue in the repository.

---

**Last Updated**: April 21, 2026
