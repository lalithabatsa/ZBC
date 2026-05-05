let allData = [];

// Utility for Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">${message}</div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function updateLoadingProgress(pct, message) {
    const bar = document.getElementById('progressBar');
    const overlay = document.getElementById('loadingOverlay');
    const p = overlay.querySelector('p');
    if (bar) bar.style.width = `${pct}%`;
    if (p) p.textContent = message;
}

function hideLoadingScreen() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}



class LaminateCostingForm {
    constructor(containerId, sku, partnerForm = null) {
        this.container = document.getElementById(containerId);
        this.sku = sku;
        this.partnerForm = partnerForm;

        this.data = []; // Local copy of filtered data for rows
        const getDef = (base) => base * (1 + (0.10 + Math.random() * 0.05));
        this.rows = [
            { name: 'm-LLDPE', pct: 50, grade: '', price: getDef(114) },
            { name: 'Enhanced LLDPE', pct: 10, grade: '', price: getDef(127) },
            { name: 'LDPE', pct: 10, grade: '', price: getDef(113) },
            { name: 'Nylon', pct: 15, grade: '', price: getDef(192) },
            { name: 'Tie Resin', pct: 5, grade: '', price: getDef(185) },
            { name: 'WMB', pct: 9.5, grade: '', price: getDef(215) },
            { name: 'PPA', pct: 0.5, grade: '', price: getDef(1.28) }
        ];

        this.renderBaseHTML();
        
        this.els = {
            tableBody: this.section.querySelector('tbody'),
            summary: {
                totalBase: this.section.querySelector('#totalBase'),
                wastagePct: this.section.querySelector('#wastagePct'),
                wastageCost: this.section.querySelector('#wastageCost'),
                filmCost: this.section.querySelector('#filmCost'),
                ohPct: this.section.querySelector('#ohPct'),
                ohCost: this.section.querySelector('#ohCost'),
                conversionCost: this.section.querySelector('#conversionCostInput'),
                totalFilmCost: this.section.querySelector('#totalFilmCostDisplay')
            }
        };

        this.initEventListeners();
        this.recalculate();
    }

    setPartner(partner) {
        this.partnerForm = partner;
    }


    reset() {
        // Clear localStorage first
        localStorage.removeItem('laminateCostingData');

        // Reset rows to zero and empty values
        this.rows.forEach((row, i) => {
            const rowEl = this.section.querySelector(`tr[data-index="${i}"]`);
            
            // Reset Internal Data
            row.grade = '';
            row.price = 0;
            const defaults = [50, 10, 10, 15, 5, 9.5, 0.5];
            row.pct = defaults[i];

            // Reset UI
            rowEl.querySelector('.row-supplier').value = '';
            rowEl.querySelector('.row-location').value = '';
            rowEl.querySelector('.row-state').value = '';
            rowEl.querySelector('.row-zone').value = '';
            rowEl.querySelector('.grade-search').value = '';
            rowEl.querySelector('.row-price-input').value = '';
            rowEl.querySelector('.row-pct').value = row.pct;
            
            const infoIcon = rowEl.querySelector('.row-info');
            if (infoIcon) infoIcon.style.display = 'none';

            this.updateRowCascadingFilters(i, true);
        });

        this.els.summary.wastagePct.value = 4;
        this.els.summary.ohPct.value = 10;
        this.els.summary.conversionCost.value = (2 + Math.random() * 3).toFixed(2);
        
        this.recalculate();
    }

    getData() {
        return {
            rows: this.rows.map((row, i) => {
                const rowEl = this.section.querySelector(`tr[data-index="${i}"]`);
                return {
                    supplier: rowEl.querySelector('.row-supplier').value,
                    location: rowEl.querySelector('.row-location').value,
                    state: rowEl.querySelector('.row-state').value,
                    zone: rowEl.querySelector('.row-zone').value,
                    grade: rowEl.querySelector('.grade-search').value,
                    pct: parseFloat(rowEl.querySelector('.row-pct').value) || 0,
                    price: row.price
                };
            }),
            summary: {
                wastagePct: parseFloat(this.els.summary.wastagePct.value) || 0,
                ohPct: parseFloat(this.els.summary.ohPct.value) || 0,
                conversionCost: parseFloat(this.els.summary.conversionCost.value) || 0
            }
        };
    }

    setData(data) {
        if (!data || !data.rows) return;
        data.rows.forEach((rowData, i) => {
            const rowEl = this.section.querySelector(`tr[data-index="${i}"]`);
            if (!rowEl) return;

            // Set inputs and trigger population
            rowEl.querySelector('.row-supplier').value = rowData.supplier || '';
            rowEl.querySelector('.row-location').value = rowData.location;
            this.updateRowCascadingFilters(i, true);
            
            rowEl.querySelector('.row-state').value = rowData.state;
            this.updateRowCascadingFilters(i, true);
            
            rowEl.querySelector('.row-zone').value = rowData.zone;
            this.updateRowCascadingFilters(i, true);

            rowEl.querySelector('.grade-search').value = rowData.grade;
            this.rows[i].grade = rowData.grade;
            this.rows[i].price = rowData.price;
            this.rows[i].pct = rowData.pct;
            
            rowEl.querySelector('.row-pct').value = rowData.pct;
            rowEl.querySelector('.row-price-input').value = rowData.price ? rowData.price.toFixed(2) : '';
        });

        if (data.summary) {
            this.els.summary.wastagePct.value = data.summary.wastagePct;
            this.els.summary.ohPct.value = data.summary.ohPct;
            this.els.summary.conversionCost.value = data.summary.conversionCost || (2 + Math.random() * 3).toFixed(2);
        }
        this.recalculate();
    }




    renderBaseHTML() {
        const section = document.createElement('section');
        section.className = 'pricing-section laminate-costing';
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">${this.sku} Film Cost</h2>
                <button class="btn-secondary btn-small row-reset">Reset Sheet</button>
            </div>
            
            <div class="table-container" style="overflow-x: auto;">
                <table class="costing-table">
                    <thead>
                        <tr>
                            <th style="width: 130px;">Polymer</th>
                            <th style="width: 140px;">Supplier Name</th>
                            <th style="width: 140px;">Supply Loc.</th>
                            <th style="width: 120px;">State</th>
                            <th style="width: 120px;">Zone</th>
                            <th style="width: 150px;">Grade</th>
                            <th style="width: 70px;">% percentage</th>
                            <th style="width: 90px;">Price/KG</th>
                            <th style="width: 100px;">Amount</th>
                            <th style="width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.rows.map((row, i) => `
                            <tr data-index="${i}">
                                <td style="font-size: 0.85rem;"><b>${row.name}</b></td>
                                <td><select class="row-supplier select-small" style="width: 100%;"><option value="">-</option></select></td>
                                <td><select class="row-location select-small" style="width: 100%;"><option value="">-</option></select></td>
                                <td><select class="row-state select-small" style="width: 100%;"><option value="">-</option></select></td>
                                <td><select class="row-zone select-small" style="width: 100%;"><option value="">-</option></select></td>
                                <td>
                                    <div class="search-container">
                                        <input type="text" class="grade-search search-input" placeholder="Search..." style="padding: 0.2rem; font-size: 0.85rem;">
                                        <div class="grade-dropdown dropdown-results"></div>
                                    </div>
                                </td>
                                <td><input type="number" class="row-pct" value="${row.pct}" style="text-align: center; width: 50px;"></td>
                                <td><input type="number" class="row-price-input" value="${row.price.toFixed(2)}" placeholder="0.00" style="text-align: right; width: 70px;"></td>
                                <td class="amount-col" style="position: relative; text-align: right; padding-right: 20px;">
                                    <span class="amount-val">0.00</span>
                                    <div class="info-icon row-info" style="display: none; position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 14px; height: 14px; line-height: 14px;">?
                                        <div class="tooltip source-tooltip" style="top: 100%; right: 0; left: auto; transform: none; margin-top: 5px;">
                                            <p><b>Book:</b> <span class="tt-book">-</span></p>
                                            <p><b>Sheet:</b> <span class="tt-sheet">-</span></p>
                                            <p><b>Cell:</b> <span class="tt-cell">-</span></p>
                                        </div>
                                    </div>
                                </td>
                                <td style="width: 40px;"><button class="btn row-refresh" style="padding: 2px 6px; font-size: 0.75rem;">↻</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="summary-card">
                <div class="summary-row">
                    <span>Total</span>
                    <span id="totalBase">0.00</span>
                </div>
                <div class="summary-row">
                    <span>Wastage %</span>
                    <input type="number" id="wastagePct" value="4" step="0.5">
                </div>
                <div class="summary-row">
                    <span>Wastage Cost</span>
                    <span id="wastageCost">0.00</span>
                </div>
                <div class="summary-row">
                    <span>Film Cost</span>
                    <span id="filmCost">0.00</span>
                </div>
                <div class="summary-row">
                    <span>O/H Percentage %</span>
                    <input type="number" id="ohPct" value="10" step="0.5">
                </div>
                <div class="summary-row">
                    <span>Overhead Cost</span>
                    <span id="ohCost">0.00</span>
                </div>
                <div class="summary-row">
                    <span>Conversion Cost</span>
                    <input type="number" id="conversionCostInput" value="${(2 + Math.random() * 3).toFixed(2)}" step="0.1">
                </div>
                <div class="summary-row total" style="background: #eab308; color: #1e293b; padding: 0.75rem; border-radius: 6px; border-top: none;">
                    <span>Total Film Cost</span>
                    <span id="totalFilmCostDisplay">0.00</span>
                </div>
            </div>
        `;
        this.container.appendChild(section);
        this.section = section;
    }

    initEventListeners() {
        this.section.querySelectorAll('tr[data-index]').forEach(rowEl => {
            const index = rowEl.dataset.index;
            const supSelect = rowEl.querySelector('.row-supplier');
            const locSelect = rowEl.querySelector('.row-location');
            const stateSelect = rowEl.querySelector('.row-state');
            const zoneSelect = rowEl.querySelector('.row-zone');
            const searchInput = rowEl.querySelector('.grade-search');
            const dropdown = rowEl.querySelector('.grade-dropdown');
            const refreshBtn = rowEl.querySelector('.row-refresh');

            supSelect.addEventListener('change', () => this.updateRowCascadingFilters(index));
            locSelect.addEventListener('change', () => this.updateRowCascadingFilters(index));
            stateSelect.addEventListener('change', () => this.updateRowCascadingFilters(index));
            zoneSelect.addEventListener('change', () => this.updateRowCascadingFilters(index));

            searchInput.addEventListener('input', (e) => this.renderRowGradeDropdown(index, e.target.value));
            searchInput.addEventListener('focus', () => this.renderRowGradeDropdown(index, searchInput.value));

            dropdown.addEventListener('click', (e) => {
                if (e.target.classList.contains('dropdown-item')) {
                    this.selectRowGrade(index, e.target.dataset.value);
                }
            });

            refreshBtn.addEventListener('click', () => this.updateRowPrice(index));

            rowEl.querySelector('.row-pct').addEventListener('input', () => this.recalculate());
            rowEl.querySelector('.row-price-input').addEventListener('input', () => this.recalculate());
        });

        const resetBtn = this.section.querySelector('.row-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm("Reset this costing sheet?")) {
                    this.reset();
                    // Also clear from storage
                    const savedData = localStorage.getItem('skuCostingData');
                    if (savedData) {
                        const parsed = JSON.parse(savedData);
                        if (parsed[this.sku]) {
                            delete parsed[this.sku];
                            localStorage.setItem('skuCostingData', JSON.stringify(parsed));
                        }
                    }
                    showToast(`${this.sku} reset successfully`, "info");
                }
            });
        }


        ['wastagePct', 'ohPct', 'conversionCost'].forEach(id => {
            this.els.summary[id].addEventListener('input', () => this.recalculate());
        });

        document.addEventListener('click', (e) => {
            this.section.querySelectorAll('.dropdown-results').forEach(d => {
                const searchInput = d.previousElementSibling;
                if (!d.contains(e.target) && !searchInput.contains(e.target)) {
                    d.classList.remove('active');
                }
            });
        });
    }

    populateInitialDropdowns() {
        this.rows.forEach((row, i) => {
            this.updateRowCascadingFilters(i, true);
        });
    }

    updateRowCascadingFilters(i, initial = false) {
        const rowEl = this.section.querySelector(`tr[data-index="${i}"]`);
        const row = this.rows[i];

        const supSelect = rowEl.querySelector('.row-supplier');
        const locSelect = rowEl.querySelector('.row-location');
        const stateSelect = rowEl.querySelector('.row-state');
        const zoneSelect = rowEl.querySelector('.row-zone');

        const selectedSup = supSelect.value;
        const selectedLoc = locSelect.value;
        const selectedState = stateSelect.value;
        const selectedZone = zoneSelect.value;

        // Filter allData for this row's material type
        let searchMat = row.name.toUpperCase();
        if (searchMat.includes('LLDPE')) searchMat = 'LLDPE';
        else if (searchMat.includes('LDPE')) searchMat = 'LDPE';
        else if (searchMat.includes('HDPE')) searchMat = 'HDPE';

        let rowData = allData.filter(d => (d.folder_key || "").toUpperCase() === searchMat);

        // Populate Suppliers (for now same as locations as requested)
        const suppliers = [...new Set(rowData.map(d => d.location))].sort();
        supSelect.innerHTML = '<option value="">-</option>' +
            suppliers.map(s => `<option value="${s}">${s}</option>`).join('');
        if (suppliers.includes(selectedSup)) supSelect.value = selectedSup;

        // Populate Locations
        const locations = [...new Set(rowData.map(d => d.location))].sort();
        locSelect.innerHTML = '<option value="">-</option>' +
            locations.map(l => `<option value="${l}">${l}</option>`).join('');
        if (locations.includes(selectedLoc)) locSelect.value = selectedLoc;

        if (locSelect.value) rowData = rowData.filter(d => d.location === locSelect.value);

        // Populate States
        const states = [...new Set(rowData.map(d => d.state))].sort();
        stateSelect.innerHTML = '<option value="">-</option>' +
            states.map(s => `<option value="${s}">${s}</option>`).join('');
        if (states.includes(selectedState)) stateSelect.value = selectedState;

        if (stateSelect.value) rowData = rowData.filter(d => d.state === stateSelect.value);

        // Populate Zones
        const zones = [...new Set(rowData.map(d => d.zone))].sort();
        zoneSelect.innerHTML = '<option value="">-</option>' +
            zones.map(z => `<option value="${z}">${z}</option>`).join('');
        if (zones.includes(selectedZone)) zoneSelect.value = selectedZone;

        if (!initial) {
            this.updateRowPrice(i);
        }
    }

    renderRowGradeDropdown(index, filter = '') {
        const rowEl = this.section.querySelector(`tr[data-index="${index}"]`);
        const location = rowEl.querySelector('.row-location').value;
        const state = rowEl.querySelector('.row-state').value;
        const zone = rowEl.querySelector('.row-zone').value;
        const row = this.rows[index];

        // Filter allData for this row's material type
        let searchMaterial = row.name.toUpperCase();
        if (searchMaterial.includes('LLDPE')) searchMaterial = 'LLDPE';
        else if (searchMaterial.includes('LDPE')) searchMaterial = 'LDPE';
        else if (searchMaterial.includes('HDPE')) searchMaterial = 'HDPE';

        let filtered = allData.filter(d => (d.folder_key || "").toUpperCase() === searchMaterial);
        if (location) filtered = filtered.filter(d => d.location === location);
        if (state) filtered = filtered.filter(d => d.state === state);
        if (zone) filtered = filtered.filter(d => d.zone === zone);

        const grades = [...new Set(filtered.map(d => d.grade))].sort();
        const visibleGrades = filter ? grades.filter(g => g.toLowerCase().includes(filter.toLowerCase())) : grades;

        const dropdown = rowEl.querySelector('.grade-dropdown');
        dropdown.innerHTML = visibleGrades.map(g => `<div class="dropdown-item" data-value="${g}">${g}</div>`).join('');

        if (visibleGrades.length > 0) dropdown.classList.add('active');
        else dropdown.classList.remove('active');
    }

    selectRowGrade(index, grade) {
        const rowEl = this.section.querySelector(`tr[data-index="${index}"]`);
        rowEl.querySelector('.grade-search').value = grade;
        rowEl.querySelector('.grade-dropdown').classList.remove('active');
        this.rows[index].grade = grade;
        this.updateRowPrice(index);
    }

    updateRowPrice(index) {
        const rowEl = this.section.querySelector(`tr[data-index="${index}"]`);
        const row = this.rows[index];
        const location = rowEl.querySelector('.row-location').value;
        const state = rowEl.querySelector('.row-state').value;
        const zone = rowEl.querySelector('.row-zone').value;
        const grade = row.grade;

        let searchMaterial = row.name.toUpperCase();
        if (searchMaterial.includes('LLDPE')) searchMaterial = 'LLDPE';
        else if (searchMaterial.includes('LDPE')) searchMaterial = 'LDPE';
        else if (searchMaterial.includes('HDPE')) searchMaterial = 'HDPE';

        const match = allData.find(d =>
            (d.folder_key || "").toUpperCase() === searchMaterial &&
            (!location || d.location === location) &&
            (!state || d.state === state) &&
            (!zone || d.zone === zone) &&
            d.grade === grade
        );

        if (match) {
            const pricePerKg = match.price / 1000;
            row.price = pricePerKg;
            rowEl.querySelector('.row-price-input').value = pricePerKg.toFixed(2);

            // Show and update tooltip
            const infoIcon = rowEl.querySelector('.row-info');
            if (infoIcon) {
                infoIcon.style.display = 'inline-flex';
                const tooltip = infoIcon.querySelector('.source-tooltip');
                if (tooltip) {
                    tooltip.querySelector('.tt-book').textContent = match.meta.source_file;
                    tooltip.querySelector('.tt-sheet').textContent = match.meta.sheet;
                    tooltip.querySelector('.tt-cell').textContent = match.meta.cell_ref;
                }
            }
        } else {
            const infoIcon = rowEl.querySelector('.row-info');
            if (infoIcon) infoIcon.style.display = 'none';
        }
        this.recalculate();
    }

    recalculate() {
        let base = 0;
        this.section.querySelectorAll('tr[data-index]').forEach((rowEl, i) => {
            const pct = parseFloat(rowEl.querySelector('.row-pct').value) || 0;
            const priceValue = parseFloat(rowEl.querySelector('.row-price-input').value) || 0;
            this.rows[i].price = priceValue;
            const amount = (pct * priceValue) / 100;
            const amountVal = rowEl.querySelector('.amount-val');
            if (amountVal) amountVal.textContent = amount.toFixed(2);
            base += amount;
        });

        const wastagePct = parseFloat(this.els.summary.wastagePct.value) || 0;
        const wastageCost = base * (wastagePct / 100);
        const filmCost = base + wastageCost;

        const ohPct = parseFloat(this.els.summary.ohPct.value) || 0;
        const ohCost = filmCost * (ohPct / 100);
        
        const conversionCost = parseFloat(this.els.summary.conversionCost.value) || 0;
        const totalFilmCost = filmCost + ohCost + conversionCost;

        this.els.summary.totalBase.textContent = base.toFixed(2);
        this.els.summary.wastageCost.textContent = wastageCost.toFixed(2);
        this.els.summary.filmCost.textContent = filmCost.toFixed(2);
        this.els.summary.ohCost.textContent = ohCost.toFixed(2);
        this.els.summary.totalFilmCost.textContent = totalFilmCost.toFixed(2);


        // Notify the partner Final Form about the change
        if (this.partnerForm) {
            this.partnerForm.setRMBasePrice(totalFilmCost);
        }
    }

}

class FinalLaminateCostForm {
    constructor(containerId, sku) {
        this.container = document.getElementById(containerId);
        this.sku = sku;
        this.baseFilmRate = 0;

        this.data = {
            substrate: { mic: 60, gsm: 58.8, rate: 0, cont: 98 },
            ink: { gsm: 0, rate: 0, cont: 0, total: 0 },
            wastage: 4,
            packing: 3.00,
            freight: 0,
            plate: 2.50,
            overhead: 10,
            sellingFreight: 10
        };

        this.renderBaseHTML();
        this.initEventListeners();
        this.recalculate();
    }


    reset() {
        localStorage.removeItem('finalLaminateData');
        this.section.querySelectorAll('input').forEach(input => {
            // Restore defaults
            if (input.classList.contains('val-mic')) input.value = 60;
            else if (input.classList.contains('val-gsm')) input.value = 58.8;
            else if (input.classList.contains('val-cont')) input.value = 98;
            else if (input.classList.contains('wastage-pct')) input.value = 4;
            else if (input.classList.contains('packing-val')) input.value = 3.00;
            else if (input.classList.contains('freight-val')) input.value = 0;
            else if (input.classList.contains('plate-val')) input.value = 2.50;
            else if (input.classList.contains('oh-pct')) input.value = 10;
            else if (input.classList.contains('selling-freight')) input.value = 10;
        });
        this.recalculate();
    }

    getData() {
        const data = {};
        this.section.querySelectorAll('input').forEach(input => {
            data[input.className] = input.value;
        });
        return data;
    }

    setData(data) {
        if (!data) return;
        Object.keys(data).forEach(className => {
            const input = this.section.querySelector(`.${className}`);
            if (input) input.value = data[className];
        });
        this.recalculate();
    }



    renderBaseHTML() {
        const section = document.createElement('section');
        section.className = 'pricing-section final-cost-section';
        section.innerHTML = `
            <h2 class="section-title">${this.sku} Final Cost</h2>
            <div class="table-container">
                <table class="final-cost-table">
                    <thead>
                        <tr class="main-header">
                            <th>Final Cost Sheet</th>
                            <th colspan="3" class="center">Actual Values</th>
                            <th>Cont % gsm</th>
                            <th>Total Amt/kg</th>
                        </tr>
                        <tr class="sub-header">
                            <th>Substrate</th>
                            <th>Mic</th>
                            <th>Gsm</th>
                            <th>Rate</th>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="row-substrate">
                            <td><b>Film Poly</b></td>
                            <td><input type="number" class="val-mic" value="${this.data.substrate.mic}"></td>
                            <td><input type="number" class="val-gsm" value="${this.data.substrate.gsm}"></td>
                            <td class="subRate muted" style="position: relative;">
                                <span>From table ↑</span>
                                <div class="info-icon" style="position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 14px; height: 14px; line-height: 14px;">?
                                    <div class="tooltip" style="top: 100%; right: 0; left: auto; transform: none; margin-top: 5px;">
                                        <p>Calculated total from <b>Film Cost</b> section above.</p>
                                    </div>
                                </div>
                            </td>
                            <td><input type="number" class="val-cont" value="${this.data.substrate.cont}">%</td>
                            <td class="subTotal amt-bold">0.00</td>
                        </tr>
                        <tr class="row-ink">
                            <td><b>Ink</b></td>
                            <td class="muted">-</td>
                            <td class="ink-gsm-display">0.0</td>
                            <td class="ink-rate-display">0.00</td>
                            <td class="ink-cont-display">0.0%</td>
                            <td class="inkTotal amt-bold">0.00</td>
                        </tr>
                        <tr class="row-total">
                            <td colspan="5">Total</td>
                            <td class="grandTotal">0.00</td>
                        </tr>
                        <tr class="row-wastage">
                            <td colspan="4">Wastage</td>
                            <td><input type="number" class="wastage-pct" value="${this.data.wastage}">%</td>
                            <td class="wastageAmt">0.00</td>
                        </tr>
                        <tr class="row-subtotal">
                            <td colspan="5">Total RM Cost</td>
                            <td class="totalRMC">0.00</td>
                        </tr>
                        <tr class="row-packing">
                            <td colspan="5">Packing Cost /kg</td>
                            <td style="position: relative;">
                                <input type="number" class="packing-val" value="${this.data.packing}">
                                <div class="info-icon" style="position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 14px; height: 14px; line-height: 14px;">?
                                    <div class="tooltip" style="top: 100%; right: 0; left: auto; transform: none; margin-top: 5px;">
                                        <p>Average packing material & labor cost per KG.</p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <tr class="row-freight-in">
                            <td colspan="5">Freight (Inward)</td>
                            <td style="position: relative;">
                                <input type="number" class="freight-val" value="${this.data.freight}">
                                <div class="info-icon" style="position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 14px; height: 14px; line-height: 14px;">?
                                    <div class="tooltip" style="top: 100%; right: 0; left: auto; transform: none; margin-top: 5px;">
                                        <p>Logistics cost for incoming raw materials.</p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <tr class="row-plate">
                            <td colspan="5">Plate Cost</td>
                            <td style="position: relative;">
                                <input type="number" class="plate-val" value="${this.data.plate}">
                                <div class="info-icon" style="position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 14px; height: 14px; line-height: 14px;">?
                                    <div class="tooltip" style="top: 100%; right: 0; left: auto; transform: none; margin-top: 5px;">
                                        <p>Printing plate/cylinder amortization cost.</p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <tr class="row-subtotal">
                            <td colspan="5">Total RMC /Kg</td>
                            <td class="totalRMCKg">0.00</td>
                        </tr>
                        <tr class="row-overhead">
                            <td colspan="4">Overhead</td>
                            <td><input type="number" class="oh-pct" value="${this.data.overhead}">%</td>
                            <td class="ohAmt" style="position: relative;">
                                <span class="val">0.00</span>
                                <div class="info-icon" style="position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 14px; height: 14px; line-height: 14px;">?
                                    <div class="tooltip" style="top: 100%; right: 0; left: auto; transform: none; margin-top: 5px;">
                                        <p>Fixed overheads (Electricity, Rent, Admin, etc.)</p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <tr class="row-selling">
                            <td colspan="5">Selling Price /kg</td>
                            <td class="sellingPrice">0.00</td>
                        </tr>
                        <tr class="row-freight-out">
                            <td colspan="5">Freight Cost (Outward)</td>
                            <td style="position: relative;">
                                <input type="number" class="selling-freight" value="${this.data.sellingFreight}">
                                <div class="info-icon" style="position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 14px; height: 14px; line-height: 14px;">?
                                    <div class="tooltip" style="top: 100%; right: 0; left: auto; transform: none; margin-top: 5px;">
                                        <p>Logistics cost for finished product delivery.</p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <tr class="row-final">
                            <td colspan="5">FINAL COST</td>
                            <td class="finalCostDisplay" style="font-weight: 700; color: var(--accent);">0.00</td>
                        </tr>
                    </tbody>
                </table>

            </div>
            <div class="form-footer-specific">
                <button class="btn-primary sku-save-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Save this SKU
                </button>
            </div>
        `;
        this.container.appendChild(section);
        this.section = section;
    }

    initEventListeners() {
        this.section.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.recalculate());
        });

        const saveBtn = this.section.querySelector('.sku-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (window.saveSpecificSKU) window.saveSpecificSKU(this.sku);
                showToast(`${this.sku} saved successfully`, "success");
            });
        }

    }

    populateInitialDropdowns() {
        // No dropdowns to populate - recalculate with current values
        this.recalculate();
    }

    setRMBasePrice(price) {
        this.baseFilmRate = price;
        this.recalculate();
    }

    setInkDetails(details) {
        this.data.ink = details;
        this.recalculate();
    }

    recalculate() {
        // Substrate
        const subRateCell = this.section.querySelector('.subRate');
        if (subRateCell) {
            subRateCell.textContent = this.baseFilmRate.toFixed(2);
            subRateCell.classList.remove('muted');
        }
        const subCont = parseFloat(this.section.querySelector('.val-cont').value) || 0;
        const subTotal = (this.baseFilmRate * subCont) / 100;
        this.section.querySelector('.subTotal').textContent = subTotal.toFixed(2);

        // Ink (Now from external InkCostingForm)
        const inkTotal = this.data.ink.total || 0;
        this.section.querySelector('.ink-gsm-display').textContent = (this.data.ink.gsm || 0).toFixed(1);
        this.section.querySelector('.ink-rate-display').textContent = (this.data.ink.rate || 0).toFixed(2);
        this.section.querySelector('.ink-cont-display').textContent = (this.data.ink.cont || 0).toFixed(1) + '%';
        this.section.querySelector('.inkTotal').textContent = inkTotal.toFixed(2);

        // Grand Total
        const grandTotal = subTotal + inkTotal;
        this.section.querySelector('.grandTotal').textContent = grandTotal.toFixed(2);

        // Wastage
        const wastagePct = parseFloat(this.section.querySelector('.wastage-pct').value) || 0;
        const wastageAmt = (grandTotal * wastagePct) / 100;
        this.section.querySelector('.wastageAmt').textContent = wastageAmt.toFixed(2);

        // Total RM Cost
        const totalRMC = grandTotal + wastageAmt;
        this.section.querySelector('.totalRMC').textContent = totalRMC.toFixed(2);

        // Additional Costs
        const packing = parseFloat(this.section.querySelector('.packing-val').value) || 0;
        const freightIn = parseFloat(this.section.querySelector('.freight-val').value) || 0;
        const plate = parseFloat(this.section.querySelector('.plate-val').value) || 0;

        const totalRMCKg = totalRMC + packing + freightIn + plate;
        this.section.querySelector('.totalRMCKg').textContent = totalRMCKg.toFixed(2);

        // Overhead
        const ohPct = parseFloat(this.section.querySelector('.oh-pct').value) || 0;
        const ohAmt = (totalRMCKg * ohPct) / 100;
        this.section.querySelector('.ohAmt').textContent = ohAmt.toFixed(2);

        // Selling Price
        const sellingPrice = totalRMCKg + ohAmt;
        this.section.querySelector('.sellingPrice').textContent = sellingPrice.toFixed(2);

        // Final Cost
        const freightOut = parseFloat(this.section.querySelector('.selling-freight').value) || 0;
        const finalCost = sellingPrice + freightOut;
        this.section.querySelector('.finalCostDisplay').textContent = finalCost.toFixed(2);
    }

}

class InkCostingForm {
    constructor(containerId, sku, partnerForm = null) {
        this.container = document.getElementById(containerId);
        this.sku = sku;
        this.partnerForm = partnerForm;

        this.rows = [
            { name: 'Process Ink', grade: '', price: 1400, pct: 2 }
        ];

        this.renderBaseHTML();
        this.initEventListeners();
        this.recalculate();
    }

    setPartner(partner) {
        this.partnerForm = partner;
        this.recalculate(); // Sync initial state
    }

    getData() {
        return {
            rows: this.rows.map((row, i) => {
                const rowEl = this.section.querySelector(`tr[data-index="${i}"]`);
                return {
                    supplier: rowEl.querySelector('.row-supplier').value,
                    location: rowEl.querySelector('.row-location').value,
                    state: rowEl.querySelector('.row-state').value,
                    zone: rowEl.querySelector('.row-zone').value,
                    grade: rowEl.querySelector('.grade-search').value,
                    pct: parseFloat(rowEl.querySelector('.row-pct').value) || 0,
                    price: row.price
                };
            })
        };
    }

    setData(data) {
        if (!data) return;
        
        // Handle legacy format
        let rows = data.rows;
        if (!rows && data.rate !== undefined) {
            rows = [{
                name: 'Process Ink',
                supplier: '',
                location: '',
                state: '',
                zone: '',
                grade: 'Process Ink',
                pct: data.cont || 0,
                price: data.rate || 0
            }];
        }

        if (!rows) return;

        rows.forEach((rowData, i) => {
            const rowEl = this.section.querySelector(`tr[data-index="${i}"]`);
            if (!rowEl) return;

            rowEl.querySelector('.row-supplier').value = rowData.supplier || '';
            rowEl.querySelector('.row-location').value = rowData.location || '';
            this.updateRowCascadingFilters(i, true);
            
            rowEl.querySelector('.row-state').value = rowData.state || '';
            this.updateRowCascadingFilters(i, true);
            
            rowEl.querySelector('.row-zone').value = rowData.zone || '';
            this.updateRowCascadingFilters(i, true);

            rowEl.querySelector('.grade-search').value = rowData.grade || '';
            this.rows[i].grade = rowData.grade || '';
            this.rows[i].price = rowData.price || 0;
            this.rows[i].pct = rowData.pct || 0;
            
            rowEl.querySelector('.row-pct').value = rowData.pct || 0;
            rowEl.querySelector('.row-price-input').value = rowData.price ? rowData.price.toFixed(2) : '';
        });
        this.recalculate();
    }

    renderBaseHTML() {
        const section = document.createElement('section');
        section.className = 'pricing-section ink-costing';
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">${this.sku} Ink Cost</h2>
            </div>
            <div class="table-container" style="overflow-x: auto;">
                <table class="costing-table">
                    <thead>
                        <tr>
                            <th style="width: 130px;">Ink Type</th>
                            <th style="width: 140px;">Supplier Name</th>
                            <th style="width: 140px;">Supply Loc.</th>
                            <th style="width: 120px;">State</th>
                            <th style="width: 120px;">Zone</th>
                            <th style="width: 150px;">Grade</th>
                            <th style="width: 70px;">% percentage</th>
                            <th style="width: 90px;">Price/KG</th>
                            <th style="width: 100px;">Amount</th>
                            <th style="width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.rows.map((row, i) => `
                            <tr data-index="${i}">
                                <td style="font-size: 0.85rem;"><b>${row.name}</b></td>
                                <td><select class="row-supplier select-small" style="width: 100%;"><option value="">-</option></select></td>
                                <td><select class="row-location select-small" style="width: 100%;"><option value="">-</option></select></td>
                                <td><select class="row-state select-small" style="width: 100%;"><option value="">-</option></select></td>
                                <td><select class="row-zone select-small" style="width: 100%;"><option value="">-</option></select></td>
                                <td>
                                    <div class="search-container">
                                        <input type="text" class="grade-search search-input" placeholder="Search..." style="padding: 0.2rem; font-size: 0.85rem;">
                                        <div class="grade-dropdown dropdown-results"></div>
                                    </div>
                                </td>
                                <td><input type="number" class="row-pct" value="${row.pct}" style="text-align: center; width: 50px;"></td>
                                <td><input type="number" class="row-price-input" value="${row.price.toFixed(2)}" placeholder="0.00" style="text-align: right; width: 70px;"></td>
                                <td class="amount-col" style="position: relative; text-align: right; padding-right: 20px;">
                                    <span class="amount-val">0.00</span>
                                    <div class="info-icon row-info" style="display: none; position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 14px; height: 14px; line-height: 14px;">?
                                        <div class="tooltip source-tooltip" style="top: 100%; right: 0; left: auto; transform: none; margin-top: 5px;">
                                            <p><b>Book:</b> <span class="tt-book">-</span></p>
                                            <p><b>Sheet:</b> <span class="tt-sheet">-</span></p>
                                            <p><b>Cell:</b> <span class="tt-cell">-</span></p>
                                        </div>
                                    </div>
                                </td>
                                <td style="width: 40px;"><button class="btn row-refresh" style="padding: 2px 6px; font-size: 0.75rem;">↻</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="summary-card" style="margin-top: 1rem;">
                <div class="summary-row total" style="background: #eab308; color: #1e293b; padding: 0.75rem; border-radius: 6px;">
                    <span>Total Ink Cost</span>
                    <span class="ink-total-amt">0.00</span>
                </div>
            </div>
        `;
        this.container.appendChild(section);
        this.section = section;
    }

    initEventListeners() {
        this.section.querySelectorAll('tr[data-index]').forEach(rowEl => {
            const index = rowEl.dataset.index;
            const supSelect = rowEl.querySelector('.row-supplier');
            const locSelect = rowEl.querySelector('.row-location');
            const stateSelect = rowEl.querySelector('.row-state');
            const zoneSelect = rowEl.querySelector('.row-zone');
            const searchInput = rowEl.querySelector('.grade-search');
            const dropdown = rowEl.querySelector('.grade-dropdown');
            const refreshBtn = rowEl.querySelector('.row-refresh');

            supSelect.addEventListener('change', () => this.updateRowCascadingFilters(index));
            locSelect.addEventListener('change', () => this.updateRowCascadingFilters(index));
            stateSelect.addEventListener('change', () => this.updateRowCascadingFilters(index));
            zoneSelect.addEventListener('change', () => this.updateRowCascadingFilters(index));

            searchInput.addEventListener('input', (e) => this.renderRowGradeDropdown(index, e.target.value));
            searchInput.addEventListener('focus', () => this.renderRowGradeDropdown(index, searchInput.value));

            dropdown.addEventListener('click', (e) => {
                if (e.target.classList.contains('dropdown-item')) {
                    this.selectRowGrade(index, e.target.dataset.value);
                }
            });

            refreshBtn.addEventListener('click', () => this.updateRowPrice(index));

            rowEl.querySelector('.row-pct').addEventListener('input', () => this.recalculate());
            rowEl.querySelector('.row-price-input').addEventListener('input', () => this.recalculate());
        });

        document.addEventListener('click', (e) => {
            this.section.querySelectorAll('.dropdown-results').forEach(d => {
                const searchInput = d.previousElementSibling;
                if (!d.contains(e.target) && !searchInput.contains(e.target)) {
                    d.classList.remove('active');
                }
            });
        });
    }

    populateInitialDropdowns() {
        this.rows.forEach((row, i) => {
            this.updateRowCascadingFilters(i, true);
        });
    }

    updateRowCascadingFilters(i, initial = false) {
        const rowEl = this.section.querySelector(`tr[data-index="${i}"]`);
        const row = this.rows[i];

        const supSelect = rowEl.querySelector('.row-supplier');
        const locSelect = rowEl.querySelector('.row-location');
        const stateSelect = rowEl.querySelector('.row-state');
        const zoneSelect = rowEl.querySelector('.row-zone');

        const selectedSup = supSelect.value;
        const selectedLoc = locSelect.value;
        const selectedState = stateSelect.value;
        const selectedZone = zoneSelect.value;

        let searchMat = "INK"; // Default for InkCostingForm
        let rowData = allData.filter(d => (d.folder_key || "").toUpperCase().includes(searchMat));

        const suppliers = [...new Set(rowData.map(d => d.location))].sort();
        supSelect.innerHTML = '<option value="">-</option>' + suppliers.map(s => `<option value="${s}">${s}</option>`).join('');
        if (suppliers.includes(selectedSup)) supSelect.value = selectedSup;

        const locations = [...new Set(rowData.map(d => d.location))].sort();
        locSelect.innerHTML = '<option value="">-</option>' + locations.map(l => `<option value="${l}">${l}</option>`).join('');
        if (locations.includes(selectedLoc)) locSelect.value = selectedLoc;

        if (locSelect.value) rowData = rowData.filter(d => d.location === locSelect.value);

        const states = [...new Set(rowData.map(d => d.state))].sort();
        stateSelect.innerHTML = '<option value="">-</option>' + states.map(s => `<option value="${s}">${s}</option>`).join('');
        if (states.includes(selectedState)) stateSelect.value = selectedState;

        if (stateSelect.value) rowData = rowData.filter(d => d.state === stateSelect.value);

        const zones = [...new Set(rowData.map(d => d.zone))].sort();
        zoneSelect.innerHTML = '<option value="">-</option>' + zones.map(z => `<option value="${z}">${z}</option>`).join('');
        if (zones.includes(selectedZone)) zoneSelect.value = selectedZone;

        if (!initial) {
            this.updateRowPrice(i);
        }
    }

    renderRowGradeDropdown(index, filter = '') {
        const rowEl = this.section.querySelector(`tr[data-index="${index}"]`);
        const location = rowEl.querySelector('.row-location').value;
        const state = rowEl.querySelector('.row-state').value;
        const zone = rowEl.querySelector('.row-zone').value;
        
        let searchMaterial = "INK";
        let filtered = allData.filter(d => (d.folder_key || "").toUpperCase().includes(searchMaterial));
        if (location) filtered = filtered.filter(d => d.location === location);
        if (state) filtered = filtered.filter(d => d.state === state);
        if (zone) filtered = filtered.filter(d => d.zone === zone);

        const grades = [...new Set(filtered.map(d => d.grade))].sort();
        const visibleGrades = filter ? grades.filter(g => g.toLowerCase().includes(filter.toLowerCase())) : grades;

        const dropdown = rowEl.querySelector('.grade-dropdown');
        dropdown.innerHTML = visibleGrades.map(g => `<div class="dropdown-item" data-value="${g}">${g}</div>`).join('');

        if (visibleGrades.length > 0) dropdown.classList.add('active');
        else dropdown.classList.remove('active');
    }

    selectRowGrade(index, grade) {
        const rowEl = this.section.querySelector(`tr[data-index="${index}"]`);
        rowEl.querySelector('.grade-search').value = grade;
        rowEl.querySelector('.grade-dropdown').classList.remove('active');
        this.rows[index].grade = grade;
        this.updateRowPrice(index);
    }

    updateRowPrice(index) {
        const rowEl = this.section.querySelector(`tr[data-index="${index}"]`);
        const row = this.rows[index];
        const location = rowEl.querySelector('.row-location').value;
        const state = rowEl.querySelector('.row-state').value;
        const zone = rowEl.querySelector('.row-zone').value;
        const grade = row.grade;

        let searchMaterial = "INK";
        const match = allData.find(d =>
            (d.folder_key || "").toUpperCase().includes(searchMaterial) &&
            (!location || d.location === location) &&
            (!state || d.state === state) &&
            (!zone || d.zone === zone) &&
            d.grade === grade
        );

        if (match) {
            const pricePerKg = match.price / 1000;
            row.price = pricePerKg;
            rowEl.querySelector('.row-price-input').value = pricePerKg.toFixed(2);

            const infoIcon = rowEl.querySelector('.row-info');
            if (infoIcon) {
                infoIcon.style.display = 'inline-flex';
                const tooltip = infoIcon.querySelector('.source-tooltip');
                if (tooltip) {
                    tooltip.querySelector('.tt-book').textContent = match.meta.source_file;
                    tooltip.querySelector('.tt-sheet').textContent = match.meta.sheet;
                    tooltip.querySelector('.tt-cell').textContent = match.meta.cell_ref;
                }
            }
        } else {
            const infoIcon = rowEl.querySelector('.row-info');
            if (infoIcon) infoIcon.style.display = 'none';
        }
        this.recalculate();
    }

    recalculate() {
        let totalInkCost = 0;
        this.section.querySelectorAll('tr[data-index]').forEach((rowEl, i) => {
            const pct = parseFloat(rowEl.querySelector('.row-pct').value) || 0;
            const priceValue = parseFloat(rowEl.querySelector('.row-price-input').value) || 0;
            this.rows[i].price = priceValue;
            this.rows[i].pct = pct;
            const amount = (pct * priceValue) / 100;
            const amountVal = rowEl.querySelector('.amount-val');
            if (amountVal) amountVal.textContent = amount.toFixed(2);
            totalInkCost += amount;
        });

        this.section.querySelector('.ink-total-amt').textContent = totalInkCost.toFixed(2);
        
        if (this.partnerForm) {
            // We need to send some GSM value since FinalLaminateCostForm expects it
            // For now we keep it compatible by sending the first row's details or aggregated
            const firstRow = this.rows[0];
            this.partnerForm.setInkDetails({ 
                gsm: 1.0, // Default gsm as it's not in the new table columns but requested to match film cost
                rate: firstRow.price, 
                cont: firstRow.pct, 
                total: totalInkCost 
            });
        }
    }
}

// Global state and initialization
const SKUS = ["Laminate", "HBC Palm 1L", "HBC Palm 0.5L", "HBC SBO 1L", "H&T SBO 1L", "H&T KGMO 1L"];
const PLANTS = ["Haldia", "Kandla", "Jaipur", "KP"];
let skuForms = {}; // { 'SKU Name': [LaminateForm, InkForm, FinalForm] }

async function fetchData(isRefresh = false) {
    const statusBox = document.getElementById('statusBox');
    try {
        if (!isRefresh) {
            updateLoadingProgress(30, "Connecting to database...");
        }

        const response = await fetch('/api/data');
        const newData = await response.json();
        
        if (!isRefresh) updateLoadingProgress(70, "Parsing price records...");

        const dataChanged = JSON.stringify(newData) !== JSON.stringify(allData);
        allData = newData;

        if (isRefresh) {
            if (dataChanged) {
                showToast("New data loaded successfully!");
            } else {
                showToast("No New data found", "info");
            }
        }

        if (Object.keys(skuForms).length === 0) {
            SKUS.forEach(sku => {
                const containerId = `container-${sku}`;
                // Order: Film Cost, Ink Cost, Final Laminate Cost
                const costingForm = new LaminateCostingForm(containerId, sku);
                const inkForm = new InkCostingForm(containerId, sku);
                const finalForm = new FinalLaminateCostForm(containerId, sku);
                
                // Link them
                costingForm.setPartner(finalForm);
                inkForm.setPartner(finalForm);
                
                skuForms[sku] = [costingForm, inkForm, finalForm];
            });
        }



        // Force reset history to align with the new ₹250 price points requested by user
        const mockHistory = {};
        const today = new Date();
        
        SKUS.forEach((sku, i) => {
            // Base rate around 250 as seen in current calculations
            const base = 250 + (Math.random() * 10 - 5); 
            mockHistory[sku] = [
                { date: new Date(today - 86400000 * 30).toISOString(), rate: base * (0.98 + Math.random() * 0.04) },
                { date: new Date(today - 86400000 * 20).toISOString(), rate: base * (0.98 + Math.random() * 0.04) },
                { date: new Date(today - 86400000 * 10).toISOString(), rate: base * (0.98 + Math.random() * 0.04) },
                { date: new Date(today - 86400000 * 5).toISOString(), rate: base }
            ];
        });
        localStorage.setItem('skuRateHistory', JSON.stringify(mockHistory));
        let history = localStorage.getItem('skuRateHistory');

        Object.values(skuForms).forEach(forms => {
            forms.forEach(f => {
                if (typeof f.populateInitialDropdowns === 'function') {
                    f.populateInitialDropdowns();
                } else {
                    console.warn("Form missing populateInitialDropdowns:", f);
                }
            });
        });
        
        // Load saved state for all SKUs
        const savedData = localStorage.getItem('skuCostingData');
        const parsed = savedData ? JSON.parse(savedData) : {};
        
        SKUS.forEach(sku => {
            if (parsed[sku]) {
                skuForms[sku][0].setData(parsed[sku].laminate);
                if (parsed[sku].ink) skuForms[sku][1].setData(parsed[sku].ink);
                skuForms[sku][2].setData(parsed[sku].final);
            } else {
                // Task 1: Apply default values if no record exists
                applyDefaultValues(sku);
            }
        });

        if (!isRefresh) {
            updateLoadingProgress(100, "System Ready");
            setTimeout(hideLoadingScreen, 500);
        }

    } catch (err) {
        console.error("Error fetching data:", err);
        if (statusBox) {
            statusBox.style.display = 'block';
            statusBox.textContent = "Error: Failed to connect to backend.";
            statusBox.className = "status-banner error";
        }
        hideLoadingScreen();
        showToast("System initialization failed.", "warning");
    }
}

// Main Navigation Logic
document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.mainTab;
        
        // Update Buttons
        document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update Panels
        document.querySelectorAll('.main-panel').forEach(p => p.classList.remove('active'));
        if (tab === 'executive') {
            document.getElementById('executiveView').classList.add('active');
        } else {
            document.getElementById('skusView').classList.add('active');
        }
    });
});

// Executive Sub-Navigation Logic
document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const subTab = btn.dataset.subTab;
        
        // Update Buttons
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update Panels
        document.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`${subTab}-panel`).classList.add('active');

        // If Dashboard tab, render it
        if (subTab === 'dashboard') {
            renderDashboard();
        }

        // If ZBC Rates tab, render it
        if (subTab === 'zbc-rates') {
            renderZBCRates();
        }

        // If Roster tab, render it
        if (subTab === 'roster') {
            renderMaterialRoster();
        }

        // If Packaging Cost tab, render it
        if (subTab === 'packaging-cost') {
            renderPackagingCost();
        }

        // If Freight Cost tab, render it
        if (subTab === 'freight-cost') {
            renderFreightCost();
        }

        // If Conversion Cost tab, render it
        if (subTab === 'conversion-cost') {
            renderConversionCost();
        }
    });
});

function renderZBCRates() {
    const container = document.getElementById('zbcRatesContainer');
    if (!container) return;

    const descriptions = {
        "Laminate": "A common surface material in furniture and interior design, laminates are flexible and strong",
        "HBC Palm 1L": "High-quality Palm oil laminate (1L)",
        "HBC Palm 0.5L": "High-quality Palm oil laminate (0.5L)",
        "HBC SBO 1L": "Soyabean Oil laminate (1L)",
        "H&T SBO 1L": "H&T brand Soyabean Oil laminate (1L)",
        "H&T KGMO 1L": "H&T brand Kachi Ghani Mustard Oil laminate (1L)"
    };

    container.innerHTML = `
        <div class="zbc-section">
            <h3 style="margin-bottom: 1rem; color: var(--primary);">SKU Final Rates</h3>
            <table class="costing-table">
                <thead>
                    <tr>
                        <th>SKU Name</th>
                        <th>Description</th>
                        <th style="text-align: right;">Rate (Now) (₹/kg)</th>
                    </tr>
                </thead>
                <tbody>
                    ${SKUS.map(sku => {
                        const finalForm = skuForms[sku] ? skuForms[sku][2] : null;
                        const rateEl = finalForm ? finalForm.section.querySelector('.finalCostDisplay') : null;
                        const rate = rateEl ? rateEl.textContent : "0.00";
                        return `
                            <tr>
                                <td><a href="#" class="sku-link" data-sku="${sku}"><b>${sku}</b></a></td>
                                <td style="font-size: 0.85rem; color: var(--text-muted);">${descriptions[sku] || "Description of SKU"}</td>
                                <td style="text-align: right; font-weight: 700; color: var(--accent);">₹ ${rate}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.querySelectorAll('.sku-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToSKU(link.dataset.sku);
        });
    });
}

function renderDashboard() {
    const tableContainer = document.getElementById('dashboardTableContainer');
    if (!tableContainer) return;

    const history = JSON.parse(localStorage.getItem('skuRateHistory') || "{}");
    const volumes = { 
        "Laminate": "1,200", 
        "HBC Palm 1L": "850", 
        "HBC Palm 0.5L": "2,100", 
        "HBC SBO 1L": "450", 
        "H&T SBO 1L": "1,600", 
        "H&T KGMO 1L": "900" 
    };

    const dashboardData = SKUS.map(sku => {
        const finalForm = skuForms[sku] ? skuForms[sku][2] : null;
        const rateEl = finalForm ? finalForm.section.querySelector('.finalCostDisplay') : null;
        const presentRate = rateEl ? parseFloat(rateEl.textContent) : 0;
        
        const skuHistory = history[sku] || [];

        const previousRate = skuHistory.length > 1 ? skuHistory[skuHistory.length - 2].rate : presentRate;
        
        const diff = presentRate - previousRate;
        const trend = previousRate !== 0 ? (diff / previousRate) * 100 : 0;

        return { sku, volume: volumes[sku] || "0", presentRate, previousRate, diff, trend };
    });

    tableContainer.innerHTML = `
        <table class="costing-table">
            <thead>
                <tr>
                    <th>SKU</th>
                    <th>Volume (Units)</th>
                    <th>Present Rate</th>
                    <th>Previous Rate</th>
                    <th>Diff</th>
                    <th>Trend</th>
                </tr>
            </thead>
            <tbody>
                ${dashboardData.map(d => `
                    <tr>
                        <td><b>${d.sku}</b></td>
                        <td>${d.volume}</td>
                        <td style="font-weight: 600;">₹ ${d.presentRate.toFixed(2)}</td>
                        <td style="color: var(--text-muted);">₹ ${d.previousRate.toFixed(2)}</td>
                        <td style="color: ${d.diff >= 0 ? '#ef4444' : '#10b981'}; font-weight: 600;">
                            ${d.diff >= 0 ? '+' : ''}${d.diff.toFixed(2)}
                        </td>
                        <td>
                            <span class="trend-badge ${d.trend >= 0 ? 'up' : 'down'}" style="color: ${d.trend >= 0 ? '#ef4444' : '#10b981'}; font-weight: 700;">
                                ${d.trend >= 0 ? '↑' : '↓'} ${Math.abs(d.trend).toFixed(1)}%
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    renderTrendChart(history);
}

function applyDefaultValues(sku) {
    const forms = skuForms[sku];
    if (!forms) return;

    const laminateForm = forms[0];
    const getVal = (base) => {
        const factor = 1 + (0.10 + Math.random() * 0.05); // 10% to 15% difference
        return base * factor;
    };

    const defaults = {
        'm-LLDPE': 114,
        'Enhanced LLDPE': 127,
        'LDPE': 113,
        'Nylon': 192,
        'Tie Resin': 185,
        'WMB': 215,
        'PPA': 1.28
    };

    laminateForm.rows.forEach((row, i) => {
        const base = defaults[row.name];
        if (base) {
            const val = getVal(base);
            const rowEl = laminateForm.section.querySelector(`tr[data-index="${i}"]`);
            if (rowEl) {
                const priceInput = rowEl.querySelector('.row-price-input');
                priceInput.value = val.toFixed(2);
                row.price = val;
                
                // For LLDPEs/LDPE, try to pick a suitable location and grade
                if (row.name.includes('LLDPE') || row.name.includes('LDPE')) {
                    let searchMat = row.name.toUpperCase();
                    if (searchMat.includes('LLDPE')) searchMat = 'LLDPE';
                    else if (searchMat.includes('LDPE')) searchMat = 'LDPE';
                    
                    const matches = allData.filter(d => (d.folder_key || "").toUpperCase() === searchMat);
                    if (matches.length > 0) {
                        const match = matches[Math.floor(Math.random() * Math.min(matches.length, 5))]; // Randomly pick one of the first 5
                        rowEl.querySelector('.row-supplier').value = match.location;
                        rowEl.querySelector('.row-location').value = match.location;
                        laminateForm.updateRowCascadingFilters(i, true);
                        rowEl.querySelector('.row-state').value = match.state;
                        laminateForm.updateRowCascadingFilters(i, true);
                        rowEl.querySelector('.row-zone').value = match.zone;
                        laminateForm.updateRowCascadingFilters(i, true);
                        rowEl.querySelector('.grade-search').value = match.grade;
                        row.grade = match.grade;

                        // Task: Show tooltip for default values
                        const infoIcon = rowEl.querySelector('.row-info');
                        if (infoIcon) {
                            infoIcon.style.display = 'inline-flex';
                            const tt = infoIcon.querySelector('.source-tooltip');
                            if (tt) {
                                tt.querySelector('.tt-book').textContent = match.meta.source_file;
                                tt.querySelector('.tt-sheet').textContent = match.meta.sheet;
                                tt.querySelector('.tt-cell').textContent = match.meta.cell_ref;
                            }
                        }
                    }
                }
            }
        }
    });
    laminateForm.recalculate();

    // Pick default for Ink if possible
    const inkForm = forms[1];
    inkForm.rows.forEach((row, i) => {
        const matches = allData.filter(d => (d.folder_key || "").toUpperCase().includes("INK"));
        if (matches.length > 0) {
            const match = matches[0];
            const rowEl = inkForm.section.querySelector(`tr[data-index="${i}"]`);
            if (rowEl) {
                rowEl.querySelector('.row-supplier').value = match.location;
                rowEl.querySelector('.row-location').value = match.location;
                inkForm.updateRowCascadingFilters(i, true);
                rowEl.querySelector('.row-state').value = match.state;
                inkForm.updateRowCascadingFilters(i, true);
                rowEl.querySelector('.row-zone').value = match.zone;
                inkForm.updateRowCascadingFilters(i, true);
                rowEl.querySelector('.grade-search').value = match.grade;
                row.grade = match.grade;
                row.price = match.price / 1000;
                rowEl.querySelector('.row-price-input').value = row.price.toFixed(2);
            }
        }
    });
    inkForm.recalculate();
}

let trendChartInstance = null;
function renderTrendChart(history) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    if (trendChartInstance) trendChartInstance.destroy();

    // Task 4: Update chart to include trajectory till recent date for ALL SKUs
    const todayStr = new Date().toLocaleDateString();
    
    // Collect all unique dates across all SKU histories to create a unified timeline
    const allDatesSet = new Set();
    SKUS.forEach(sku => {
        (history[sku] || []).forEach(h => allDatesSet.add(new Date(h.date).toLocaleDateString()));
    });
    allDatesSet.add(todayStr);
    
    // Convert to sorted array
    const labels = Array.from(allDatesSet).sort((a, b) => new Date(a) - new Date(b));

    const datasets = SKUS.map((sku, index) => {
        const skuHistory = history[sku] || [];
        const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
        
        // Map history to the unified timeline, carrying forward the last known rate
        let lastRate = skuHistory.length > 0 ? skuHistory[0].rate : 0;
        const dataPoints = labels.map(labelDate => {
            const match = skuHistory.find(h => new Date(h.date).toLocaleDateString() === labelDate);
            if (match) {
                lastRate = match.rate;
                return match.rate;
            }
            return lastRate; // Carry forward the trajectory
        });

        return {
            label: sku,
            data: dataPoints,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 5
        };
    });

    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
            scales: {
                y: { beginAtZero: false, grid: { color: '#f1f5f9' }, title: { display: true, text: 'Rate (₹/kg)', font: { size: 10 } } },
                x: { grid: { display: false } }
            }
        }
    });
}

function navigateToSKU(sku) {
    const skusTabBtn = document.querySelector('.main-tab-btn[data-main-tab="skus"]');
    if (skusTabBtn) skusTabBtn.click();
    const selector = document.getElementById('skuSelector');
    if (selector) {
        selector.value = sku;
        selector.dispatchEvent(new Event('change'));
    }
}

function renderMaterialRoster() {
    const container = document.getElementById('materialRosterContainer');
    const selector = document.getElementById('rosterSkuSelector');
    if (!container || !selector) return;

    if (selector.options.length <= 1) {
        selector.innerHTML = '<option value="All">All SKUs</option>' + 
            SKUS.map(sku => `<option value="${sku}">${sku}</option>`).join('');
        selector.addEventListener('change', renderMaterialRoster);
    }

    const selectedSku = selector.value;
    const selectedMaterials = [];

    const skusToProcess = selectedSku === 'All' ? SKUS : [selectedSku];

    skusToProcess.forEach(sku => {
        const forms = skuForms[sku];
        if (!forms) return;

        // 1. From Film Cost Table (Polymers)
        forms[0].rows.forEach(row => {
            if (row.grade && row.price > 0) {
                const rowEl = forms[0].section.querySelector(`tr[data-index="${forms[0].rows.indexOf(row)}"]`);
                const weightage = rowEl ? parseFloat(rowEl.querySelector('.row-pct').value) || 0 : row.pct;
                
                selectedMaterials.push({
                    name: row.name,
                    grade: row.grade,
                    price: row.price,
                    sku: sku,
                    weightage: weightage
                });
            }
        });

        // 2. From Ink Cost Section
        const inkData = forms[1].getData();
        if (inkData.rows) {
            inkData.rows.forEach(row => {
                if (row.grade && row.price > 0) {
                    selectedMaterials.push({
                        name: 'Ink',
                        grade: row.grade,
                        price: row.price,
                        sku: sku,
                        weightage: row.pct
                    });
                }
            });
        }

        // 3. From Final Cost Section (Substrate weightage)
        // Substrate names/prices are already in Film Cost, but we need the % from Final Cost
        const finalSection = forms[2].section;
        const subContEl = finalSection.querySelector('.val-cont');
        const subWeightage = subContEl ? parseFloat(subContEl.value) || 0 : 0;
        
        // We don't add the substrate as a new material here because it's a composite of the polymers
        // But the user might want to see the specific substrate grade if it was a single entry.
        // For now, the polymers represent the substrate.
    });

    // 4. Add default benchmark materials (only if All or Benchmark is relevant)
    if (selectedSku === 'All') {
        const benchmarks = [
            { name: 'Nylon', grade: 'Benchmark', price: 192, sku: 'Benchmark', weightage: 0 },
            { name: 'Tie Resin', grade: 'Benchmark', price: 185, sku: 'Benchmark', weightage: 0 },
            { name: 'WMB', grade: 'Benchmark', price: 215, sku: 'Benchmark', weightage: 0 },
            { name: 'PPA', grade: 'Benchmark', price: 1.28, sku: 'Benchmark', weightage: 0 }
        ];
        benchmarks.forEach(b => selectedMaterials.push(b));
    }

    // Deduplicate and aggregate
    const uniqueMaterials = {};
    selectedMaterials.forEach(m => {
        const key = `${m.name}|${m.grade}`;
        if (!uniqueMaterials[key]) {
            let match = null;
            if (m.grade !== 'Benchmark') {
                let searchMaterial = m.name.toUpperCase();
                if (searchMaterial.includes('LLDPE')) searchMaterial = 'LLDPE';
                else if (searchMaterial.includes('LDPE')) searchMaterial = 'LDPE';
                
                match = allData.find(d => 
                    (d.folder_key || "").toUpperCase() === searchMaterial && 
                    d.grade === m.grade
                );
            }
            uniqueMaterials[key] = { 
                name: m.name, 
                grade: m.grade, 
                price: m.price, 
                match,
                usages: [] 
            };
        }
        if (m.sku !== 'Benchmark' && m.weightage > 0) {
            uniqueMaterials[key].usages.push({ sku: m.sku, weightage: m.weightage });
        }
    });

    const rosterData = Object.values(uniqueMaterials);
    rosterData.sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = `
        <table class="costing-table">
            <thead>
                <tr>
                    <th>Material</th>
                    <th>Selected Grade</th>
                    <th>Weightage (%)</th>
                    <th style="text-align: right;">Latest Price (₹/MT)</th>
                </tr>
            </thead>
            <tbody>
                ${rosterData.length === 0 ? `<tr><td colspan="4" class="muted" style="text-align: center; padding: 2rem;">No materials found for the selected filter.</td></tr>` : ''}
                ${rosterData.map(m => `
                    <tr>
                        <td>
                            <a href="#" class="material-history-link" data-name="${m.name}" data-grade="${m.grade}" data-price="${m.price}">
                                <b>${m.name}</b>
                            </a>
                        </td>
                        <td>${m.grade}</td>
                        <td style="font-size: 0.8rem; color: var(--text-muted);">
                            ${m.usages.length > 0 
                                ? m.usages.map(u => `<span>${u.sku}: <b>${u.weightage}%</b></span>`).join('<br>') 
                                : '<span class="muted">-</span>'}
                        </td>
                        <td style="text-align: right; font-weight: 600; position: relative; padding-right: 30px;">
                            ₹ ${m.price.toLocaleString('en-IN')}
                            ${m.match ? `
                                <div class="info-icon" style="position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 14px; height: 14px; line-height: 14px;">?
                                    <div class="tooltip" style="top: 100%; right: 0; left: auto; transform: none; margin-top: 5px;">
                                        <p><b>Book:</b> <span>${m.match.meta.source_file}</span></p>
                                        <p><b>Sheet:</b> <span>${m.match.meta.sheet}</span></p>
                                        <p><b>Cell:</b> <span>${m.match.meta.cell_ref}</span></p>
                                    </div>
                                </div>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.querySelectorAll('.material-history-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const { name, grade, price } = link.dataset;
            showMaterialHistory(name, grade, parseFloat(price));
        });
    });
}

const skuSelector = document.getElementById('skuSelector');
if (skuSelector) {
    skuSelector.addEventListener('change', (e) => {
        const sku = e.target.value;
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) pageTitle.textContent = sku;
        document.querySelectorAll('.sku-panel').forEach(p => p.classList.remove('active'));
        const activePanel = document.getElementById(`container-${sku}`);
        if (activePanel) activePanel.classList.add('active');
    });
}

const plantSelector = document.getElementById('plantSelector');
const dashboardPlantSelector = document.getElementById('dashboardPlantSelector');
const freightPlantSelector = document.getElementById('freightPlantSelector');

function syncPlant(e) {
    const plant = e.target.value;
    if (plantSelector) plantSelector.value = plant;
    if (dashboardPlantSelector) dashboardPlantSelector.value = plant;
    if (freightPlantSelector) {
        // freightPlantSelector doesn't have "All" usually, but let's be safe
        if ([...freightPlantSelector.options].some(o => o.value === plant)) {
            freightPlantSelector.value = plant;
        }
    }
    showToast(`Switched to ${plant} plant view`, "info");

    // Re-render dashboard if we are on it
    const activeSubTab = document.querySelector('.sub-tab-btn.active');
    if (activeSubTab && activeSubTab.dataset.subTab === 'dashboard') {
        renderDashboard();
    }
}

if (plantSelector) plantSelector.addEventListener('change', syncPlant);
if (dashboardPlantSelector) dashboardPlantSelector.addEventListener('change', syncPlant);
if (freightPlantSelector) {
    freightPlantSelector.addEventListener('change', (e) => {
        syncPlant(e);
        renderFreightCost();
    });
}

function saveSpecificSKU(sku) {
    const savedData = localStorage.getItem('skuCostingData') || "{}";
    const allData = JSON.parse(savedData);
    allData[sku] = { 
        laminate: skuForms[sku][0].getData(), 
        ink: skuForms[sku][1].getData(),
        final: skuForms[sku][2].getData() 
    };
    localStorage.setItem('skuCostingData', JSON.stringify(allData));

    const history = JSON.parse(localStorage.getItem('skuRateHistory') || "{}");
    if (!history[sku]) history[sku] = [];
    const rateEl = skuForms[sku][2].section.querySelector('.finalCostDisplay');
    const finalRate = rateEl ? parseFloat(rateEl.textContent) : 0;
    const lastEntry = history[sku][history[sku].length - 1];

    if (!lastEntry || lastEntry.rate !== finalRate) {
        history[sku].push({ date: new Date().toISOString(), rate: finalRate });
        localStorage.setItem('skuRateHistory', JSON.stringify(history));
    }
}

window.saveSpecificSKU = saveSpecificSKU;

// --- New Cost Calculators (Packaging, Freight, Conversion) ---

let packagingCostData = JSON.parse(localStorage.getItem('packagingCostData')) || {};
let freightCostData = JSON.parse(localStorage.getItem('freightCostData')) || {};
let conversionCostData = JSON.parse(localStorage.getItem('conversionCostData')) || {
    monthlyRent: 150000,
    electricityCost: 80000,
    manpowerCost: 300000,
    statutoryCost: 50000,
    totalProduction: 20000 // kg/month
};

// Initialize SKU data with random values if not present
function initializeCostData() {
    PLANTS.forEach(plant => {
        if (!freightCostData[plant]) freightCostData[plant] = {};
        SKUS.forEach(sku => {
            if (!packagingCostData[sku]) {
                packagingCostData[sku] = {
                    totalWeight: parseFloat((15 + Math.random() * 5).toFixed(2)),
                    cartonBoxCost: parseFloat((45 + Math.random() * 10).toFixed(2)),
                    coreWeight: parseFloat((450 + Math.random() * 100).toFixed(2)),
                    coreCostKg: parseFloat((35 + Math.random() * 5).toFixed(2)),
                    polybagCostKg: parseFloat((120 + Math.random() * 20).toFixed(2)),
                    polybagWeight: parseFloat((20 + Math.random() * 5).toFixed(2))
                };
            }
            if (!freightCostData[plant][sku]) {
                freightCostData[plant][sku] = {
                    weightPerRoll: parseFloat((15 + Math.random() * 5).toFixed(2)),
                    rollsPerTruck: 450 + Math.floor(Math.random() * 100),
                    distance: 800 + Math.floor(Math.random() * 400),
                    truckCost: 45000 + Math.floor(Math.random() * 10000)
                };
            }
        });
    });
}

initializeCostData();

function renderPackagingCost() {
    const container = document.getElementById('packagingCostContainer');
    const selector = document.getElementById('packagingSkuSelector');
    if (!container || !selector) return;

    // Populate selector if empty
    if (selector.options.length === 0) {
        selector.innerHTML = SKUS.map(sku => `<option value="${sku}">${sku}</option>`).join('');
        selector.addEventListener('change', renderPackagingCost);
    }

    const sku = selector.value;
    const data = packagingCostData[sku];

    const cartonPerKg = data.cartonBoxCost / data.totalWeight;
    const coreCostPerRoll = (data.coreWeight / 1000) * data.coreCostKg;
    const corePerKg = coreCostPerRoll / data.totalWeight;
    const polybagCostPerRoll = (data.polybagWeight / 1000) * data.polybagCostKg;
    const polybagPerKg = polybagCostPerRoll / data.totalWeight;
    const totalPkgCost = cartonPerKg + corePerKg + polybagPerKg;

    container.innerHTML = `
        <div class="zbc-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="color: var(--primary);">Packaging Cost Split-up: ${sku}</h3>
                <button class="btn-primary btn-small save-cost-btn" data-type="packaging">Save Changes</button>
            </div>
            <table class="costing-table">
                <tbody>
                    <tr>
                        <td>Total Weight of Roll</td>
                        <td class="muted">kg</td>
                        <td><input type="number" class="cost-input" data-key="totalWeight" value="${data.totalWeight}"></td>
                    </tr>
                    <tr>
                        <td>Cost of Carton Box</td>
                        <td class="muted">rs./box</td>
                        <td><input type="number" class="cost-input" data-key="cartonBoxCost" value="${data.cartonBoxCost}"></td>
                    </tr>
                    <tr>
                        <td class="muted">Cost of Carton Box per Kg</td>
                        <td class="muted">rs./kg</td>
                        <td style="font-weight: 600;">₹ ${cartonPerKg.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Weight of Core</td>
                        <td class="muted">grams</td>
                        <td><input type="number" class="cost-input" data-key="coreWeight" value="${data.coreWeight}"></td>
                    </tr>
                    <tr>
                        <td>Cost of Core</td>
                        <td class="muted">rs./kg</td>
                        <td><input type="number" class="cost-input" data-key="coreCostKg" value="${data.coreCostKg}"></td>
                    </tr>
                    <tr>
                        <td class="muted">Cost of Core per Kg</td>
                        <td class="muted">rs./kg</td>
                        <td style="font-weight: 600;">₹ ${corePerKg.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Cost of Polybag</td>
                        <td class="muted">rs./kg</td>
                        <td><input type="number" class="cost-input" data-key="polybagCostKg" value="${data.polybagCostKg}"></td>
                    </tr>
                    <tr>
                        <td>Weight of Polybag Used</td>
                        <td class="muted">grams</td>
                        <td><input type="number" class="cost-input" data-key="polybagWeight" value="${data.polybagWeight}"></td>
                    </tr>
                    <tr>
                        <td class="muted">Cost of Polybag Used per Roll</td>
                        <td class="muted">rs.</td>
                        <td style="font-weight: 600;">₹ ${polybagCostPerRoll.toFixed(2)}</td>
                    </tr>
                    <tr style="background: #fef9c3;">
                        <td style="font-weight: 700;">TOTAL PACKAGING COST</td>
                        <td class="muted">rs./kg</td>
                        <td style="font-weight: 700; color: var(--accent);">₹ ${totalPkgCost.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    container.querySelectorAll('.cost-input').forEach(input => {
        input.addEventListener('input', (e) => {
            packagingCostData[sku][e.target.dataset.key] = parseFloat(e.target.value) || 0;
            renderPackagingCost();
        });
    });

    container.querySelector('.save-cost-btn').addEventListener('click', () => {
        localStorage.setItem('packagingCostData', JSON.stringify(packagingCostData));
        showToast(`Packaging cost for ${sku} saved`);
    });
}

function renderFreightCost() {
    const container = document.getElementById('freightCostContainer');
    const skuSelector = document.getElementById('freightSkuSelector');
    const plantSelector = document.getElementById('freightPlantSelector');
    if (!container || !skuSelector || !plantSelector) return;

    if (skuSelector.options.length === 0) {
        skuSelector.innerHTML = SKUS.map(sku => `<option value="${sku}">${sku}</option>`).join('');
        skuSelector.addEventListener('change', renderFreightCost);
    }

    const sku = skuSelector.value;
    const plant = plantSelector.value;
    
    if (!freightCostData[plant]) freightCostData[plant] = {};
    if (!freightCostData[plant][sku]) {
        freightCostData[plant][sku] = {
            weightPerRoll: 15,
            rollsPerTruck: 450,
            distance: 800,
            truckCost: 45000
        };
    }
    
    const data = freightCostData[plant][sku];

    const totalWeightTruck = data.weightPerRoll * data.rollsPerTruck;
    const freightPerKg = totalWeightTruck > 0 ? data.truckCost / totalWeightTruck : 0;

    container.innerHTML = `
        <div class="zbc-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="color: var(--primary);">Freight Cost Split-up: ${sku}</h3>
                <button class="btn-primary btn-small save-cost-btn" data-type="freight">Save Changes</button>
            </div>
            <table class="costing-table">
                <tbody>
                    <tr>
                        <td>Weight of Roll</td>
                        <td class="muted">kg</td>
                        <td><input type="number" class="cost-input" data-key="weightPerRoll" value="${data.weightPerRoll}"></td>
                    </tr>
                    <tr>
                        <td>Total Rolls in Truck</td>
                        <td class="muted">no.s</td>
                        <td><input type="number" class="cost-input" data-key="rollsPerTruck" value="${data.rollsPerTruck}"></td>
                    </tr>
                    <tr>
                        <td class="muted">Total Weight of Rolls in Truck</td>
                        <td class="muted">kg</td>
                        <td style="font-weight: 600;">${totalWeightTruck.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Distance from Destination Plant</td>
                        <td class="muted">km</td>
                        <td><input type="number" class="cost-input" data-key="distance" value="${data.distance}"></td>
                    </tr>
                    <tr>
                        <td>Total Transportation Cost for Truck</td>
                        <td class="muted">rs.</td>
                        <td><input type="number" class="cost-input" data-key="truckCost" value="${data.truckCost}"></td>
                    </tr>
                    <tr style="background: #fef9c3;">
                        <td style="font-weight: 700;">FREIGHT COST PER KG</td>
                        <td class="muted">rs./kg</td>
                        <td style="font-weight: 700; color: var(--accent);">₹ ${freightPerKg.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    container.querySelectorAll('.cost-input').forEach(input => {
        input.addEventListener('input', (e) => {
            freightCostData[plant][sku][e.target.dataset.key] = parseFloat(e.target.value) || 0;
            renderFreightCost();
        });
    });

    container.querySelector('.save-cost-btn').addEventListener('click', () => {
        localStorage.setItem('freightCostData', JSON.stringify(freightCostData));
        showToast(`Freight cost for ${sku} at ${plant} saved`);
    });
}

function renderConversionCost() {
    const container = document.getElementById('conversionCostContainer');
    if (!container) return;

    const data = conversionCostData;
    const totalCost = data.monthlyRent + data.electricityCost + data.manpowerCost + data.statutoryCost;
    const conversionCostPerKg = data.totalProduction > 0 ? totalCost / data.totalProduction : 0;

    container.innerHTML = `
        <div class="zbc-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="color: var(--primary);">Conversion Cost Breakdown</h3>
                <button class="btn-primary btn-small save-cost-btn" data-type="conversion">Save Changes</button>
            </div>
            <table class="costing-table">
                <tbody>
                    <tr>
                        <td>Monthly Rent</td>
                        <td class="muted">rs./month</td>
                        <td><input type="number" class="cost-input" data-key="monthlyRent" value="${data.monthlyRent}"></td>
                    </tr>
                    <tr>
                        <td>Electricity Cost</td>
                        <td class="muted">rs./month</td>
                        <td><input type="number" class="cost-input" data-key="electricityCost" value="${data.electricityCost}"></td>
                    </tr>
                    <tr>
                        <td>Manpower Cost</td>
                        <td class="muted">rs./month</td>
                        <td><input type="number" class="cost-input" data-key="manpowerCost" value="${data.manpowerCost}"></td>
                    </tr>
                    <tr>
                        <td>Statutory Cost</td>
                        <td class="muted">rs./month</td>
                        <td><input type="number" class="cost-input" data-key="statutoryCost" value="${data.statutoryCost}"></td>
                    </tr>
                    <tr>
                        <td class="muted">Total Cost</td>
                        <td class="muted">rs./month</td>
                        <td style="font-weight: 600;">₹ ${totalCost.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                        <td>Total Production per Month</td>
                        <td class="muted">kg/month</td>
                        <td><input type="number" class="cost-input" data-key="totalProduction" value="${data.totalProduction}"></td>
                    </tr>
                    <tr style="background: #fef9c3;">
                        <td style="font-weight: 700;">CONVERSION COST</td>
                        <td class="muted">rs./kg</td>
                        <td style="font-weight: 700; color: var(--accent);">₹ ${conversionCostPerKg.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    container.querySelectorAll('.cost-input').forEach(input => {
        input.addEventListener('input', (e) => {
            conversionCostData[e.target.dataset.key] = parseFloat(e.target.value) || 0;
            renderConversionCost();
        });
    });

    container.querySelector('.save-cost-btn').addEventListener('click', () => {
        localStorage.setItem('conversionCostData', JSON.stringify(conversionCostData));
        showToast(`Conversion costs saved`);
    });
}

document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Checking...';
    btn.disabled = true;
    try { await fetch('/api/scrape', { method: 'POST' }); } catch (e) { console.error("Error calling scraper API:", e); }
    await fetchData(true);
    btn.innerHTML = originalText;
    btn.disabled = false;
});

fetchData();

// --- Material History Modal Logic ---
let materialHistoryChartInstance = null;

function showMaterialHistory(name, grade, currentPrice) {
    const modal = document.getElementById('materialModal');
    const title = document.getElementById('modalTitle');
    const canvas = document.getElementById('materialHistoryChart');
    if (!modal || !title || !canvas) return;

    title.textContent = `Price History: ${name} (${grade})`;
    modal.classList.add('active');

    const ctx = canvas.getContext('2d');
    if (materialHistoryChartInstance) {
        materialHistoryChartInstance.destroy();
    }

    // Generate mock history for material (since we don't have true DB history yet)
    const labels = [];
    const dataPoints = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - (i * 15));
        labels.push(date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
        
        // Random fluctuation around current price (mocking trend)
        const factor = 1 + (Math.random() * 0.08 - 0.04); // +/- 4%
        dataPoints.push(currentPrice * factor);
    }
    // Ensure the last point is the exact current price
    dataPoints[dataPoints.length - 1] = currentPrice;

    materialHistoryChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price (₹/kg)',
                data: dataPoints,
                borderColor: '#eab308',
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 6,
                pointBackgroundColor: '#eab308',
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: (context) => `Rate: ₹${context.parsed.y.toFixed(2)} /kg`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: '#f1f5f9' },
                    ticks: { 
                        font: { size: 11 },
                        callback: value => '₹' + value.toFixed(2) 
                    }
                },
                x: { 
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            },
            animations: {
                tension: {
                    duration: 1000,
                    easing: 'linear',
                    from: 1,
                    to: 0.4,
                    loop: false
                }
            }
        }
    });
}

// Modal closing logic
const closeMaterialModal = () => {
    const modal = document.getElementById('materialModal');
    if (modal) modal.classList.remove('active');
};

document.getElementById('closeModal')?.addEventListener('click', closeMaterialModal);
window.addEventListener('click', (e) => {
    const modal = document.getElementById('materialModal');
    if (e.target === modal) closeMaterialModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMaterialModal();
});



