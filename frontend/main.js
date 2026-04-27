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
        
        this.recalculate();
    }

    getData() {
        return {
            rows: this.rows.map((row, i) => {
                const rowEl = this.section.querySelector(`tr[data-index="${i}"]`);
                return {
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
                ohPct: parseFloat(this.els.summary.ohPct.value) || 0
            }
        };
    }

    setData(data) {
        if (!data || !data.rows) return;
        data.rows.forEach((rowData, i) => {
            const rowEl = this.section.querySelector(`tr[data-index="${i}"]`);
            if (!rowEl) return;

            // Set inputs and trigger population
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
        }
        this.recalculate();
    }




    renderBaseHTML() {
        const section = document.createElement('section');
        section.className = 'pricing-section laminate-costing';
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">Film Cost</h2>
                <button class="btn-secondary btn-small row-reset">Reset Sheet</button>
            </div>
            
            <div class="table-container" style="overflow-x: auto;">
                <table class="costing-table">
                    <thead>
                        <tr>
                            <th style="width: 130px;">Polymer</th>
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
            const locSelect = rowEl.querySelector('.row-location');
            const stateSelect = rowEl.querySelector('.row-state');
            const zoneSelect = rowEl.querySelector('.row-zone');
            const searchInput = rowEl.querySelector('.grade-search');
            const dropdown = rowEl.querySelector('.grade-dropdown');
            const refreshBtn = rowEl.querySelector('.row-refresh');

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


        ['wastagePct', 'ohPct'].forEach(id => {
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

        const locSelect = rowEl.querySelector('.row-location');
        const stateSelect = rowEl.querySelector('.row-state');
        const zoneSelect = rowEl.querySelector('.row-zone');

        const selectedLoc = locSelect.value;
        const selectedState = stateSelect.value;
        const selectedZone = zoneSelect.value;

        // Filter allData for this row's material type
        let searchMat = row.name.toUpperCase();
        if (searchMat.includes('LLDPE')) searchMat = 'LLDPE';
        else if (searchMat.includes('LDPE')) searchMat = 'LDPE';
        else if (searchMat.includes('HDPE')) searchMat = 'HDPE';

        let rowData = allData.filter(d => (d.folder_key || "").toUpperCase() === searchMat);

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
        const totalFilmCost = filmCost + ohCost;

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
            ink: { gsm: 1.0, rate: 1400, cont: 2 },
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
            else if (input.classList.contains('ink-gsm')) input.value = 1.0;
            else if (input.classList.contains('ink-rate')) input.value = 1400;
            else if (input.classList.contains('ink-cont')) input.value = 2;
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
            <h2 class="section-title">Final Laminate Cost</h2>
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
                            <td><input type="number" class="ink-gsm" value="${this.data.ink.gsm}"></td>
                            <td style="position: relative;">
                                <input type="number" class="ink-rate" value="${this.data.ink.rate}">
                                <div class="info-icon" style="position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 14px; height: 14px; line-height: 14px;">?
                                    <div class="tooltip" style="top: 100%; right: 0; left: auto; transform: none; margin-top: 5px;">
                                        <p>Standard Ink Market Rate (₹/MT).</p>
                                    </div>
                                </div>
                            </td>
                            <td><input type="number" class="ink-cont" value="${this.data.ink.cont}">%</td>
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

        // Ink
        const inkRate = parseFloat(this.section.querySelector('.ink-rate').value) || 0;
        const inkCont = parseFloat(this.section.querySelector('.ink-cont').value) || 0;
        const inkTotal = (inkRate * inkCont) / 100;
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

// Global state and initialization
const SKUS = ["Laminate", "SKU 2", "SKU 3", "SKU 4", "SKU 5"];
let skuForms = {}; // { 'SKU Name': [LaminateForm, FinalForm] }

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
                // Create costing form first so it appears at the top
                const costingForm = new LaminateCostingForm(containerId, sku);
                // Create final form second so it appears at the bottom
                const finalForm = new FinalLaminateCostForm(containerId, sku);
                
                // Link them
                costingForm.setPartner(finalForm);
                
                skuForms[sku] = [costingForm, finalForm];
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
            forms.forEach(f => f.populateInitialDropdowns());
        });
        
        // Load saved state for all SKUs
        const savedData = localStorage.getItem('skuCostingData');
        const parsed = savedData ? JSON.parse(savedData) : {};
        
        SKUS.forEach(sku => {
            if (parsed[sku]) {
                skuForms[sku][0].setData(parsed[sku].laminate);
                skuForms[sku][1].setData(parsed[sku].final);
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
    });
});

function renderZBCRates() {
    const container = document.getElementById('zbcRatesContainer');
    if (!container) return;

    const descriptions = {
        "Laminate": "A common surface material in furniture and interior design, laminates are flexible and strong",
        "SKU 2": "Description of SKU 2",
        "SKU 3": "Description of SKU 3",
        "SKU 4": "Description of SKU 4",
        "SKU 5": "Description of SKU 5"
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
                        const finalForm = skuForms[sku] ? skuForms[sku][1] : null;
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
    const volumes = { "Laminate": "1,200", "SKU 2": "850", "SKU 3": "2,100", "SKU 4": "450", "SKU 5": "1,600" };

    const dashboardData = SKUS.map(sku => {
        const finalForm = skuForms[sku] ? skuForms[sku][1] : null;
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
    if (!container) return;

    // Collect all unique material+grade combinations from all SKUs
    const selectedMaterials = [];

    SKUS.forEach(sku => {
        const forms = skuForms[sku];
        if (!forms) return;

        // 1. From Film Cost Table (Polymers)
        forms[0].rows.forEach(row => {
            if (row.grade && row.price > 0) {
                selectedMaterials.push({
                    name: row.name,
                    grade: row.grade,
                    price: row.price
                });
            }
        });

        // 2. From Final Cost Table (Substrates, Inks, etc.)
        const finalData = forms[1].data;
        const finalSection = forms[1].section;
        
        // Helper to extract from final form rows
        ['substrate', 'ink', 'adhesive'].forEach(type => {
            const gradeEl = finalSection.querySelector(`.row-${type} .grade-select`);
            const priceEl = finalSection.querySelector(`.row-${type} .row-price-input`);
            if (gradeEl && gradeEl.value && priceEl && parseFloat(priceEl.value) > 0) {
                selectedMaterials.push({
                    name: type.charAt(0).toUpperCase() + type.slice(1),
                    grade: gradeEl.value,
                    price: parseFloat(priceEl.value)
                });
            }
        });
    });

    // 3. Add default benchmark materials as requested
    const benchmarks = [
        { name: 'Nylon', grade: 'Benchmark', price: 192 },
        { name: 'Tie Resin', grade: 'Benchmark', price: 185 },
        { name: 'WMB', grade: 'Benchmark', price: 215 },
        { name: 'PPA', grade: 'Benchmark', price: 1.28 }
    ];
    benchmarks.forEach(b => selectedMaterials.push(b));

    // Deduplicate by material + grade and attach meta
    const uniqueMaterials = {};
    selectedMaterials.forEach(m => {
        const key = `${m.name}|${m.grade}`;
        if (!uniqueMaterials[key]) {
            // Find match in allData for tooltip (skip for benchmarks)
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
            uniqueMaterials[key] = { ...m, match };
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
                    <th style="text-align: right;">Latest Price (₹/MT)</th>
                </tr>
            </thead>
            <tbody>
                ${rosterData.length === 0 ? `<tr><td colspan="3" class="muted" style="text-align: center; padding: 2rem;">No materials selected in any SKU sheet yet.</td></tr>` : ''}
                ${rosterData.map(m => `
                    <tr>
                        <td><b>${m.name}</b></td>
                        <td>${m.grade}</td>
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

function saveSpecificSKU(sku) {
    const savedData = localStorage.getItem('skuCostingData') || "{}";
    const allData = JSON.parse(savedData);
    allData[sku] = { laminate: skuForms[sku][0].getData(), final: skuForms[sku][1].getData() };
    localStorage.setItem('skuCostingData', JSON.stringify(allData));

    const history = JSON.parse(localStorage.getItem('skuRateHistory') || "{}");
    if (!history[sku]) history[sku] = [];
    const rateEl = skuForms[sku][1].section.querySelector('.finalCostDisplay');
    const finalRate = rateEl ? parseFloat(rateEl.textContent) : 0;
    const lastEntry = history[sku][history[sku].length - 1];

    if (!lastEntry || lastEntry.rate !== finalRate) {
        history[sku].push({ date: new Date().toISOString(), rate: finalRate });
        localStorage.setItem('skuRateHistory', JSON.stringify(history));
    }
}

window.saveSpecificSKU = saveSpecificSKU;

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



