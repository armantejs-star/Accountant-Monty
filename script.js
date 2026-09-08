let db = {
            accounts: [], transactions: [], budgetItems: [], categories: [{ id: 'c1', name: 'General' }], 
            debts: [], catalog: [], activeList: [], goals: [], stocks: [], investments: [], tasks: [], incomes: [], scenarios: [],
            routine: [], appointments: [], plannerHidden: [],
            settings: { theme: 'light', syncFreq: 'Daily', syncAnchor: '', privacyMode: false, projScenEnabled: false, projScenAmt: '', projScenFreq: 'Fortnightly' }
        };

        let dashChart = null, insightBar = null, insightLine = null, forecastChartInstance = null, invProjectionChartInstance = null;
        let editingTxId = null, editingBudId = null, editingIncId = null, editingAccId = null, confirmAction = null;
        let editingStockId = null, editingLotId = null, editingLotStockId = null, editingFlatInvId = null;
        
        let fileHandle = null;
        let unsavedChanges = false;

        function getLocalDateStr() {
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        function formatDateLocal(d) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${day}/${month}/${year}`;
        }

        function fDate(dateStr) {
            if (!dateStr) return '';
            const p = dateStr.split('-');
            return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dateStr;
        }

        function updateBackupUI() {
            const warning = document.getElementById('backup-warning');
            if (warning) {
                warning.style.display = unsavedChanges ? 'inline-block' : 'none';
            }
        }

/* --- STEP 20: MODULAR SAVE FUNCTIONS --- */
        
        // Lego Block 1: Handles saving typed text so you don't lose your place
        function saveDrafts() {
            let currentDrafts = {};
            document.querySelectorAll('input, select').forEach(input => {
                if(input.id && input.type !== 'file' && input.type !== 'checkbox' && input.type !== 'radio' && input.type !== 'date') {
                    currentDrafts[input.id] = input.value;
                }
            });
            localStorage.setItem('Monty_Drafts', JSON.stringify(currentDrafts));
        }

        // Lego Block 2: Handles flashing the "Saved!" text on screen
        function showSaveIndicator() {
            const ind = document.getElementById('save-indicator');
            if(ind) {
                ind.style.opacity = '1';
                setTimeout(() => { ind.style.opacity = '0'; }, 2000);
            }
        }

        // The Main Engine: Now clean, short, and calls the smaller Lego blocks!
        function save() { 
            // 1. Core database internal save
            localStorage.setItem('AccountantMontyV6_Data', JSON.stringify(db)); 
            
            // 2. Draft synchronization
            saveDrafts();

            // 3. Mark the state as "Dirty" (needs hard backup)
            unsavedChanges = true;
            localStorage.setItem('Monty_NeedsBackup', 'true');
            updateBackupUI();

            // 4. Visual Auto-Save Indicator
            showSaveIndicator();
            
            render(); 
        }
        
function load() {
            let data = localStorage.getItem('AccountantMontyV6_Data') || localStorage.getItem('AccountantMonty_Data') || localStorage.getItem('FinanceHubV5_Data');
            
            // STEP 19 SAFETY NET: Try to load the data safely. If it's corrupted, catch the error!
            if (data) {
                try {
                    let parsedData = JSON.parse(data);
                    db = { ...db, ...parsedData };
                } catch (error) {
                    console.error("Monty encountered a corrupted save file! Recovering safely...", error);
                    alert("Warning: Monty detected a glitch in your saved data, but we kept your app running safely.");
                }
                
                // Ensure all database arrays exist even on a fresh load
                if(!db.routine) db.routine = []; if(!db.appointments) db.appointments = []; if(!db.plannerHidden) db.plannerHidden = [];
                if(!db.goals) db.goals = [];if(!db.catalog) db.catalog = []; if(!db.stocks) db.stocks = []; if(!db.investments) db.investments = [];
                if(!db.budgetItems) db.budgetItems = []; if(!db.tasks) db.tasks = []; if(!db.incomes) db.incomes = [];
                if(!db.scenarios) db.scenarios = []; 
                if(!db.settings) db.settings = { theme: 'light', syncFreq: 'Daily', syncAnchor: getLocalDateStr(), privacyMode: false, projScenEnabled: false, projScenAmt: '', projScenFreq: 'Fortnightly' };
                if(db.settings.privacyMode === undefined) db.settings.privacyMode = false;
                if(db.settings.projScenEnabled === undefined) db.settings.projScenEnabled = false;
                if(db.settings.projScenAmt === undefined) db.settings.projScenAmt = '';
                if(db.settings.projScenFreq === undefined) db.settings.projScenFreq = 'Fortnightly';
                
                if (db.subscriptions && db.subscriptions.length > 0) {
                    db.subscriptions.forEach(s => { db.budgetItems.push({ id: s.id, category: 'Subscriptions', name: s.name, amount: s.cost, freq: s.freq, date: s.date, isAllowance: false, allowance: 0 }); });
                    delete db.subscriptions; 
                    localStorage.setItem('AccountantMontyV6_Data', JSON.stringify(db));
                }
            }
            
            // Check Dirty State
            unsavedChanges = localStorage.getItem('Monty_NeedsBackup') === 'true';
            updateBackupUI();
            
            // Robust Investment Migration
            if (db.investments && db.investments.length > 0) {
                let needsSave = false;
                let newStocks = db.stocks && db.stocks.length > 0 ? db.stocks : [];
                let newInv = [];
                
                db.investments.forEach(item => {
                    if (item.val !== undefined && item.lots === undefined) {
                        item.currentPrice = item.val;
                        item.expectedReturn = 7;
                        item.lots = [{ id: generateId(), date: getLocalDateStr(), units: 1, costPerUnit: item.val }];
                        delete item.val;
                        needsSave = true;
                    }
                    
                    if(item.type === 'Stocks' || item.type === 'Crypto' || item.type === 'Stocks / Equities') {
                        if(!newStocks.find(s => s.id === item.id)) {
                            newStocks.push(item);
                            needsSave = true;
                        }
                    } else {
                        let totalVal = item.val || 0;
                        if (item.lots) {
                            if (item.currentPrice && item.lots.length > 0) {
                                totalVal = item.lots.reduce((s,l)=>s+(parseFloat(l.units)||0),0) * (parseFloat(item.currentPrice)||0);
                            } else {
                                item.lots.forEach(l => totalVal += ((parseFloat(l.units)||0) * (parseFloat(l.costPerUnit)||0)));
                            }
                            delete item.lots;
                            delete item.currentPrice;
                            delete item.expectedReturn;
                            item.val = totalVal;
                            needsSave = true;
                        }
                        newInv.push(item);
                    }
                });
                
                if (needsSave) {
                    db.stocks = newStocks;
                    db.investments = newInv;
                    localStorage.setItem('AccountantMontyV6_Data', JSON.stringify(db));
                }
            }

            db.budgetItems.forEach(b => { 
                if(!b.category) b.category = 'General'; 
                if(b.isAllowance === undefined) b.isAllowance = false; 
                if(!b.allowance) b.allowance = 0; 
            });
            db.incomes.forEach(i => { if(!i.category) i.category = 'General'; });

            if(!db.settings.syncFreq) db.settings.syncFreq = 'Daily';
            if(!db.settings.syncAnchor) db.settings.syncAnchor = getLocalDateStr();

            applyTheme();
            
            const today = getLocalDateStr();
            document.getElementById('tx-date').value = today; 
            document.getElementById('b-date').value = today; 
            document.getElementById('task-date').value = today; 
            document.getElementById('scen-date').value = today;
            if(document.getElementById('stock-buy-date')) document.getElementById('stock-buy-date').value = today;
            
            document.getElementById('settings-sync-freq').value = db.settings.syncFreq;
            document.getElementById('settings-sync-anchor').value = db.settings.syncAnchor;
            
            document.getElementById('stock-scen-enable').checked = db.settings.projScenEnabled;
            document.getElementById('stock-scen-amt').value = db.settings.projScenAmt;
            document.getElementById('stock-scen-freq').value = db.settings.projScenFreq;

            const d = new Date();
            document.getElementById('filter-start').value = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
            document.getElementById('filter-end').value = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
            
            // --- NEW: DRAFT RESTORER ---
           let drafts = JSON.parse(localStorage.getItem('Monty_Drafts') || '{}');
for(let id in drafts) {
    let el = document.getElementById(id);
    if(el && typeof drafts[id] !== 'undefined' && el.type !== 'file' && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'date') {
        el.value = drafts[id];
    }
}
            
// STEP 22: Optimized Auto-Save (Debouncing)
            let draftTimeout;
            document.querySelectorAll('input, select').forEach(input => {
                if(input.id && input.type !== 'file' && input.type !== 'checkbox' && input.type !== 'radio' && input.type !== 'date') {
                    input.addEventListener('input', () => {
                        // Clear the timer every time a key is pressed
                        clearTimeout(draftTimeout);
                        // Set a new timer to save only after typing stops for 500 milliseconds
                        draftTimeout = setTimeout(() => {
                            saveDrafts(); // Uses the new Lego block we made in Step 20!
                        }, 500);
                    });
                }
            });

            autoRollDates(); render();
        }

/* --- STEP 38 (PART 1): SECURE PRIVACY TOGGLE --- */
        function togglePrivacy() {
            db.settings.privacyMode = !db.settings.privacyMode;
            save();
            
            // If turning privacy OFF, force a clean reboot to safely restore all charts and tables
            if (!db.settings.privacyMode) {
                window.location.reload(); 
            }
        }
        
        function updateStockScenSettings() {
            db.settings.projScenEnabled = document.getElementById('stock-scen-enable').checked;
            db.settings.projScenAmt = document.getElementById('stock-scen-amt').value;
            db.settings.projScenFreq = document.getElementById('stock-scen-freq').value;
            save();
        }

        function isWithinLastXDays(dateStr, days) {
            if(!dateStr) return false;
            const tDate = new Date(dateStr + 'T00:00:00');
            const today = new Date(); today.setHours(0,0,0,0);
            const pastDate = new Date(today); pastDate.setDate(today.getDate() - days);
            return tDate >= pastDate && tDate <= new Date(today.getTime() + 86400000);
        }

/* --- STEP 25: BULLETPROOF DATE HANDLING --- */
        function advanceDateStr(dateStr, freq) {
            let d = new Date(dateStr + 'T00:00:00'); 
            if(isNaN(d.getTime())) return dateStr; 
            
            let start = d.getTime();
            let expectedDay = d.getDate(); // Remember the original day (e.g., the 31st)

            if (freq === 'Weekly') d.setDate(d.getDate() + 7);
            else if (freq === 'Fortnightly') d.setDate(d.getDate() + 14);
            else if (freq === 'Monthly') {
                d.setMonth(d.getMonth() + 1);
                if (d.getDate() < expectedDay) d.setDate(0); // Leap-bug fix!
            }
            else if (freq === 'Quarterly') {
                d.setMonth(d.getMonth() + 3);
                if (d.getDate() < expectedDay) d.setDate(0); // Leap-bug fix!
            }
            else if (freq === 'Half-Yearly') {
                d.setMonth(d.getMonth() + 6);
                if (d.getDate() < expectedDay) d.setDate(0); // Leap-bug fix!
            }
            else if (freq === 'Annually') d.setFullYear(d.getFullYear() + 1);
            
            if (d.getTime() === start) return dateStr; 
            
            let yr = d.getFullYear(); let mo = String(d.getMonth() + 1).padStart(2, '0'); let da = String(d.getDate()).padStart(2, '0');
            return `${yr}-${mo}-${da}`;
        }
        
        function retreatDateStr(dateStr, freq) {
            let d = new Date(dateStr + 'T00:00:00'); 
            if(isNaN(d.getTime())) return dateStr; 
            
            let start = d.getTime();
            let expectedDay = d.getDate();

            if (freq === 'Weekly') d.setDate(d.getDate() - 7);
            else if (freq === 'Fortnightly') d.setDate(d.getDate() - 14);
            else if (freq === 'Monthly') {
                d.setMonth(d.getMonth() - 1);
                if (d.getDate() < expectedDay) d.setDate(0); // Leap-bug fix!
            }
            else if (freq === 'Quarterly') {
                d.setMonth(d.getMonth() - 3);
                if (d.getDate() < expectedDay) d.setDate(0); // Leap-bug fix!
            }
            else if (freq === 'Half-Yearly') {
                d.setMonth(d.getMonth() - 6);
                if (d.getDate() < expectedDay) d.setDate(0); // Leap-bug fix!
            }
            else if (freq === 'Annually') d.setFullYear(d.getFullYear() - 1);
            
            if (d.getTime() === start) return dateStr; 
            
            let yr = d.getFullYear(); let mo = String(d.getMonth() + 1).padStart(2, '0'); let da = String(d.getDate()).padStart(2, '0');
            return `${yr}-${mo}-${da}`;
        }

        function autoRollDates() {
            const todayStr = getLocalDateStr(); 
            let changed = false;
            db.budgetItems.forEach(b => {
                if (b.date && b.date < todayStr && b.freq && !b.isAllowance) {
                    let safety = 0;
                    while (b.date < todayStr && safety < 100) { let nextDate = advanceDateStr(b.date, b.freq); if(nextDate === b.date) break; b.date = nextDate; safety++; }
                    changed = true;
                }
            });
            if (changed) save();
        }

/* --- STEP 29: INSTANT SYNC ENGINE UPDATES --- */
        function updateSyncSettings() {
            db.settings.syncFreq = document.getElementById('settings-sync-freq').value;
            db.settings.syncAnchor = document.getElementById('settings-sync-anchor').value;
            
            // Provide instant visual feedback to the user in the Settings tab
            const syncStatus = document.getElementById('sync-status');
            if (syncStatus) {
                syncStatus.style.color = 'var(--success)';
                syncStatus.innerText = `✓ Funding Schedule successfully updated to ${db.settings.syncFreq}`;
            }
            
            save(); // This automatically redraws the Budget tab instantly in the background!
        }

        function getEffectiveToday() {
            let sFreq = db.settings.syncFreq || 'Daily';
            if (sFreq === 'Daily') return new Date();
            let anchorStr = db.settings.syncAnchor;
            if (!anchorStr) return new Date(); 
            let anchor = new Date(anchorStr + 'T00:00:00');
            if (isNaN(anchor.getTime())) return new Date(); 
            
            anchor.setHours(0,0,0,0);
            let realToday = new Date();
            realToday.setHours(0,0,0,0);
            
            if (realToday < anchor) {
                let stepped = new Date(anchor);
                while (stepped > realToday) {
                    if (sFreq === 'Weekly') stepped.setDate(stepped.getDate() - 7);
                    else if (sFreq === 'Fortnightly') stepped.setDate(stepped.getDate() - 14);
                    else if (sFreq === 'Monthly') stepped.setMonth(stepped.getMonth() - 1);
                    else break;
                }
                return stepped;
            } else {
                let stepped = new Date(anchor);
                let lastValid = new Date(anchor);
                let safety = 0;
                while (stepped <= realToday && safety < 1000) {
                    lastValid = new Date(stepped);
                    if (sFreq === 'Weekly') stepped.setDate(stepped.getDate() + 7);
                    else if (sFreq === 'Fortnightly') stepped.setDate(stepped.getDate() + 14);
                    else if (sFreq === 'Monthly') stepped.setMonth(stepped.getMonth() + 1);
                    else break;
                    safety++;
                }
                return lastValid;
            }
        }

/* --- STEP 24: BULLETPROOF UNIVERSAL TRANSLATOR --- */
        function getSyncEquivalent(amount, itemFreq, syncFreq) {
            // 1. Force the amount to be a strict decimal number to prevent text-addition bugs
            let numAmount = parseFloat(amount) || 0;
            let annual = numAmount;
            
            // 2. Find the true annual cost of the item
            if(itemFreq === 'Weekly') annual = numAmount * 52;
            else if(itemFreq === 'Fortnightly') annual = numAmount * 26;
            else if(itemFreq === 'Monthly') annual = numAmount * 12;
            else if(itemFreq === 'Quarterly') annual = numAmount * 4;
            else if(itemFreq === 'Half-Yearly') annual = numAmount * 2;
            else if(itemFreq === 'Annually') annual = numAmount * 1;
            else if(itemFreq === 'Daily') annual = numAmount * 365;
            
            // 3. Slice that annual cost into your preferred pay schedule
            if(syncFreq === 'Weekly') return annual / 52;
            if(syncFreq === 'Fortnightly') return annual / 26;
            if(syncFreq === 'Monthly') return annual / 12;
            if(syncFreq === 'Daily') return annual / 365;
            
            return annual / 26; // Default fallback to Fortnightly if something breaks
        }

       function countPayDates(startStr, endStr, anchorStr, payFreq, strictlyBefore = false) {
            let start = new Date(startStr + 'T00:00:00').getTime();
            let end = new Date(endStr + 'T00:00:00').getTime();
            if (start >= end) return 0;
            if (payFreq === 'Daily' || !anchorStr) return Math.max(0, Math.floor((end - start) / 86400000));

            let anchor = new Date(anchorStr + 'T00:00:00');
            if (isNaN(anchor.getTime())) return Math.max(0, Math.floor((end - start) / 86400000));

            let cursor = new Date(anchor);
            let safety1 = 0;
            while(cursor.getTime() > start && safety1 < 1000) {
                if (payFreq === 'Weekly') cursor.setDate(cursor.getDate() - 7);
                else if (payFreq === 'Fortnightly') cursor.setDate(cursor.getDate() - 14);
                else if (payFreq === 'Monthly') cursor.setMonth(cursor.getMonth() - 1);
                else break;
                safety1++;
            }
            
            let safety2 = 0;
            while(cursor.getTime() < start && safety2 < 1000) {
                if (payFreq === 'Weekly') cursor.setDate(cursor.getDate() + 7);
                else if (payFreq === 'Fortnightly') cursor.setDate(cursor.getDate() + 14);
                else if (payFreq === 'Monthly') cursor.setMonth(cursor.getMonth() + 1);
                else break;
                safety2++;
            }

            let count = 0;
            let safety3 = 0;
            while((strictlyBefore ? cursor.getTime() < end : cursor.getTime() <= end) && safety3 < 1000) {
                count++;
                if (payFreq === 'Weekly') cursor.setDate(cursor.getDate() + 7);
                else if (payFreq === 'Fortnightly') cursor.setDate(cursor.getDate() + 14);
                else if (payFreq === 'Monthly') cursor.setMonth(cursor.getMonth() + 1);
                else break;
                safety3++;
            }
            return count;
        }

/* --- STEP 26: BULLETPROOF DRIP-FEED MATH --- */
        function calculateTargetSaved(amount, freq, dueDateStr) {
            // Force strict numbers to prevent text-addition glitches
            let numAmount = parseFloat(amount) || 0;
            if (!dueDateStr || numAmount <= 0) return 0;
            
            const todayStr = getLocalDateStr();
            const startStr = retreatDateStr(dueDateStr, freq);
            
            // Edge Case 1: If the bill is due today or past due, you need 100% of the cash
            if (todayStr >= dueDateStr) return numAmount;
            
            // Edge Case 2: If the billing cycle hasn't even started yet, you need $0
            if (todayStr <= startStr) return 0;
            
            const payFreq = db.settings.syncFreq || 'Daily';
            const anchorStr = db.settings.syncAnchor;
            
            // SCENARIO A: Smooth Daily Dripping
            if (payFreq === 'Daily' || !anchorStr) {
                const due = new Date(dueDateStr + 'T00:00:00').getTime(); 
                const start = new Date(startStr + 'T00:00:00').getTime();
                const today = new Date(todayStr + 'T00:00:00').getTime();
                
                let cycleDays = Math.max(1, (due - start) / 86400000);
                let daysPassed = Math.max(0, (today - start) / 86400000);
                return numAmount * Math.min(1, (daysPassed / cycleDays));
            }
            
            // SCENARIO B: Stepped Paycheck Dripping (Weekly/Fortnightly)
            const totalPaychecks = countPayDates(startStr, dueDateStr, anchorStr, payFreq, true);
            const passedPaychecks = countPayDates(startStr, todayStr, anchorStr, payFreq, false);
            
            if (totalPaychecks <= 0) return numAmount;
            
            // Calculate exactly what percentage of the bill should be saved by today
            return numAmount * Math.min(1, (passedPaychecks / totalPaychecks));
        }

        function resolveCategoryName(id) {
            const matchBud = db.budgetItems.find(b => b.id === id);
            if (matchBud) return matchBud.category;
            const matchCat = db.categories.find(c => c.id === id);
            if (matchCat) return matchCat.name;
            return 'Misc';
        }

        function addStock() {
            const name = document.getElementById('stock-name').value.trim();
            const type = document.getElementById('stock-type').value;
            const currentPrice = parseFloat(document.getElementById('stock-price').value);
            const expectedReturn = parseFloat(document.getElementById('stock-return').value) || 0;
            if(!name || isNaN(currentPrice)) return alert("Fill required fields.");
            
            if (editingStockId) {
                let s = db.stocks.find(x => x.id === editingStockId);
                if (s) { s.name = name; s.type = type; s.currentPrice = currentPrice; s.expectedReturn = expectedReturn; }
                cancelStockEdit();
            } else {
                const existing = db.stocks.find(i => i.name.toLowerCase() === name.toLowerCase());
                if(existing) {
                    existing.currentPrice = currentPrice; existing.type = type; existing.expectedReturn = expectedReturn;
                } else {
                    db.stocks.push({ id: generateId(), name, type, currentPrice, expectedReturn, lots: [] });
                }
            }
            save();
        }

        function editStock(id) {
            let s = db.stocks.find(x => x.id === id);
            if(!s) return;
            editingStockId = id;
            document.getElementById('stock-name').value = s.name;
            document.getElementById('stock-type').value = s.type;
            document.getElementById('stock-price').value = s.currentPrice;
            document.getElementById('stock-return').value = s.expectedReturn;
            document.getElementById('stock-submit-btn').innerText = 'Update';
            document.getElementById('stock-submit-btn').className = 'btn accent';
            document.getElementById('stock-cancel-btn').style.display = 'inline-block';
            window.scrollTo({top: 0, behavior: 'smooth'});
        }

        function cancelStockEdit() {
            editingStockId = null;
            document.getElementById('stock-name').value = '';
            document.getElementById('stock-price').value = '';
            document.getElementById('stock-return').value = '7';
            document.getElementById('stock-submit-btn').innerText = 'Save Asset';
            document.getElementById('stock-submit-btn').className = 'btn success';
            document.getElementById('stock-cancel-btn').style.display = 'none';
        }

        function addStockLot() {
            const assetId = document.getElementById('stock-buy-asset').value;
            const date = document.getElementById('stock-buy-date').value;
            const units = parseFloat(document.getElementById('stock-buy-units').value);
            const cost = parseFloat(document.getElementById('stock-buy-cost').value);
            
            if(!assetId || !date || isNaN(units) || isNaN(cost)) return alert("Fill all fields.");
            const asset = db.stocks.find(i => i.id === assetId);
            if(asset) {
                if (editingLotId) {
                    let lot = asset.lots.find(l => l.id === editingLotId);
                    if (lot) { lot.date = date; lot.units = units; lot.costPerUnit = cost; }
                    cancelLotEdit();
                } else {
                    asset.lots.push({ id: generateId(), date, units, costPerUnit: cost });
                }
                save();
            }
        }

        function editLot(stockId, lotId) {
            let s = db.stocks.find(x => x.id === stockId);
            if(!s) return;
            let l = s.lots.find(x => x.id === lotId);
            if(!l) return;
            
            editingLotId = lotId;
            editingLotStockId = stockId;
            document.getElementById('stock-buy-asset').value = stockId;
            document.getElementById('stock-buy-date').value = l.date;
            document.getElementById('stock-buy-units').value = l.units;
            document.getElementById('stock-buy-cost').value = l.costPerUnit;
            
            document.getElementById('lot-submit-btn').innerText = 'Update Lot';
            document.getElementById('lot-submit-btn').className = 'btn accent';
            document.getElementById('lot-cancel-btn').style.display = 'inline-block';
        }

        function cancelLotEdit() {
            editingLotId = null;
            editingLotStockId = null;
            document.getElementById('stock-buy-units').value = '';
            document.getElementById('stock-buy-cost').value = '';
            document.getElementById('stock-buy-date').value = getLocalDateStr();
            document.getElementById('lot-submit-btn').innerText = 'Log Purchase';
            document.getElementById('lot-submit-btn').className = 'btn accent';
            document.getElementById('lot-cancel-btn').style.display = 'none';
        }

        function removeLot(stockId, lotId) {
            showConfirm("Delete Purchase?", "Are you sure you want to remove this log?", () => {
                let s = db.stocks.find(x => x.id === stockId);
                if(s) { s.lots = s.lots.filter(l => l.id !== lotId); save(); }
            });
        }

        function removeStock(id) { 
            showConfirm("Delete Asset?", "This will remove the asset and all its purchase history.", () => { db.stocks = db.stocks.filter(i => i.id !== id); save(); }); 
        }

        function renderStockLots() {
            if (db.settings.privacyMode) return;
            const assetId = document.getElementById('stock-buy-asset').value;
            const tbody = document.getElementById('stock-lots-body');
            if(!tbody) return;
            tbody.innerHTML = '';
            const asset = db.stocks.find(i => i.id === assetId);
            if(asset && asset.lots && asset.lots.length > 0) {
                let sortedLots = [...asset.lots].sort((a,b) => new Date(b.date) - new Date(a.date));
                sortedLots.forEach(l => {
                    let u = parseFloat(l.units) || 0;
                    let c = parseFloat(l.costPerUnit) || 0;
                    tbody.innerHTML += `<tr>
                        <td>${fDate(l.date)}</td>
                        <td>${u}</td>
                        <td>$${c.toFixed(2)}</td>
                        <td><div class="action-btns"><button class="btn accent" style="padding:2px 6px;" onclick="editLot('${asset.id}', '${l.id}')">✎</button><button class="btn danger" style="padding:2px 6px;" onclick="removeLot('${asset.id}', '${l.id}')">X</button></div></td>
                    </tr>`;
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No purchases logged.</td></tr>`;
            }
        }

        function addFlatInv() {
            const name = document.getElementById('finv-name').value.trim();
            const type = document.getElementById('finv-type').value;
            const val = parseFloat(document.getElementById('finv-val').value);
            if(!name || isNaN(val)) return alert("Fill all fields.");
            
            if (editingFlatInvId) {
                let i = db.investments.find(x => x.id === editingFlatInvId);
                if (i) { i.name = name; i.type = type; i.val = val; }
                cancelFlatInvEdit();
            } else {
                db.investments.push({ id: generateId(), name, type, val });
            }
            save();
        }

        function editFlatInv(id) {
            let i = db.investments.find(x => x.id === id);
            if(!i) return;
            editingFlatInvId = id;
            document.getElementById('finv-name').value = i.name;
            document.getElementById('finv-type').value = i.type;
            document.getElementById('finv-val').value = i.val;
            document.getElementById('finv-submit-btn').innerText = 'Update';
            document.getElementById('finv-submit-btn').className = 'btn accent';
            document.getElementById('finv-cancel-btn').style.display = 'inline-block';
        }

        function cancelFlatInvEdit() {
            editingFlatInvId = null;
            document.getElementById('finv-name').value = '';
            document.getElementById('finv-val').value = '';
            document.getElementById('finv-submit-btn').innerText = 'Add Asset';
            document.getElementById('finv-submit-btn').className = 'btn success';
            document.getElementById('finv-cancel-btn').style.display = 'none';
        }

        function removeFlatInv(id) { 
            showConfirm("Delete Asset?", "Remove asset?", () => { db.investments = db.investments.filter(i => i.id !== id); save(); }); 
        }

        function renderForecastChart() {
            if (db.settings.privacyMode) return;
            const isDark = db.settings.theme === 'dark'; Chart.defaults.color = isDark ? '#94a3b8' : '#64748b';
let totalAccountsBal = getOptimizedBalances().total;            let expectedIncome = 0; db.incomes.forEach(inc => { expectedIncome += getSyncEquivalent(inc.amount, inc.freq, 'Fortnightly'); });
let totalFortnightlyCost = 0; db.budgetItems.forEach(b => { totalFortnightlyCost += getSyncEquivalent(b.amount, b.freq, 'Fortnightly'); });
            let baseNetSavings = expectedIncome - totalFortnightlyCost;
            
            let labels = []; let dataPointsBase = []; let dataPointsScenario = []; 
            let runningCashBase = totalAccountsBal; let runningCashScen = totalAccountsBal; 
            let trackingDate = new Date(); trackingDate.setHours(0,0,0,0);
            let currentNetSavingsScen = baseNetSavings;
            let activeScenarios = (db.scenarios || []).filter(s => s.active);
            
            for(let i = 0; i <= 12; i++) { 
                let dStr = `${String(trackingDate.getDate()).padStart(2, '0')}/${String(trackingDate.getMonth() + 1).padStart(2, '0')}/${trackingDate.getFullYear()}`;
                labels.push(dStr); dataPointsBase.push(runningCashBase.toFixed(2)); dataPointsScenario.push(runningCashScen.toFixed(2));
                let nextDate = new Date(trackingDate); nextDate.setDate(nextDate.getDate() + 14);
                runningCashBase += baseNetSavings;
                let periodSavingsScen = currentNetSavingsScen; 
                activeScenarios.forEach(s => {
                    let sDate = new Date(s.date + 'T00:00:00');
                    if (sDate >= trackingDate && sDate < nextDate) {
                        if (s.type === 'one_expense') runningCashScen -= s.amount;
                        if (s.type === 'one_income') runningCashScen += s.amount;
                        if (s.type === 'on_expense') { currentNetSavingsScen -= s.amount; periodSavingsScen -= s.amount; }
                        if (s.type === 'on_income') { currentNetSavingsScen += s.amount; periodSavingsScen += s.amount; }
                    }
                });
                runningCashScen += periodSavingsScen; trackingDate = nextDate; 
            }

            const ctx = document.getElementById('forecastChart').getContext('2d'); if(forecastChartInstance) forecastChartInstance.destroy();
            let datasets = [{ label: 'Baseline Trajectory ($)', data: dataPointsBase, borderColor: activeScenarios.length ? '#94a3b8' : '#8b5cf6', borderDash: activeScenarios.length ? [5, 5] : [], backgroundColor: 'rgba(148, 163, 184, 0.1)', fill: !activeScenarios.length, tension: 0.2, borderWidth: 2 }];
            if (activeScenarios.length > 0) datasets.push({ label: 'Scenario Trajectory ($)', data: dataPointsScenario, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.2, borderWidth: 3 });
            forecastChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: isDark ? '#334155' : '#e2e8f0' }, title: { display: true, text: 'Liquidity ($)' } }, x: { grid: { display: false } } } } });
        }

        function renderInvProjectionChart() {
            if (db.settings.privacyMode) return;
            const ctx = document.getElementById('invProjectionChart');
            if(!ctx) return;
            
            const isDark = db.settings.theme === 'dark'; 
            Chart.defaults.color = isDark ? '#94a3b8' : '#64748b';
            
            const projYears = parseInt(document.getElementById('inv-proj-years').value) || 20;
            
            let scenEnabled = db.settings.projScenEnabled && !isNaN(parseFloat(db.settings.projScenAmt));
            let scenAmt = parseFloat(db.settings.projScenAmt) || 0;
            let scenFreq = db.settings.projScenFreq || 'Fortnightly';
            let mult = scenFreq === 'Weekly' ? 52 : scenFreq === 'Fortnightly' ? 26 : scenFreq === 'Monthly' ? 12 : 1;
            let totalScenAnnualContribution = scenAmt * mult;

            let labels = [];
            let dataPointsBase = [];
            let dataPointsScen = [];
            const currentYear = new Date().getFullYear();
            const today = new Date();
            
            let totalCurrentPortfolioVal = db.stocks.reduce((sum, s) => {
                let u = s.lots ? s.lots.reduce((acc, l) => acc + (parseFloat(l.units)||0), 0) : 0;
                return sum + (u * (parseFloat(s.currentPrice) || 0));
            }, 0);

            let assetStats = db.stocks.map(i => {
                let assetUnits = 0;
                let assetInvested = 0;
                let firstDate = today;
                let lastDate = today;
                
                if (i.lots && i.lots.length > 0) {
                    let validDates = i.lots.map(l => new Date(l.date).getTime()).filter(t => !isNaN(t));
                    if(validDates.length > 0) {
                        firstDate = new Date(Math.min(...validDates));
                        lastDate = new Date(Math.max(...validDates));
                    }
                    i.lots.forEach(lot => {
                        let u = parseFloat(lot.units) || 0;
                        let c = parseFloat(lot.costPerUnit) || 0;
                        assetUnits += u;
                        assetInvested += (u * c);
                    });
                }
                
                let daysInvested = Math.max(0, (lastDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24));
                let fortnights = Math.max(1, Math.ceil(daysInvested / 14));
                let fortnightlyContribution = assetInvested / fortnights;
                
                let currentVal = assetUnits * (parseFloat(i.currentPrice) || 0);
                let assetWeight = totalCurrentPortfolioVal > 0 ? (currentVal / totalCurrentPortfolioVal) : (1 / Math.max(1, db.stocks.length));
                let annualScenContribution = totalScenAnnualContribution * assetWeight;

                return {
                    currentVal: currentVal,
                    fortnightlyContribution: fortnightlyContribution,
                    annualScenContribution: annualScenContribution,
                    rate: (parseFloat(i.expectedReturn) || 0) / 100
                };
            });

            for(let y=0; y<=projYears; y++) {
                labels.push(currentYear + y);
                let yearTotalBase = 0;
                let yearTotalScen = 0;
                
                assetStats.forEach(stat => {
                    if (y === 0) {
                        yearTotalBase += stat.currentVal;
                        yearTotalScen += stat.currentVal;
                    } else {
                        // BASELINE COMPOUNDING (Fortnightly Track)
                        let r_f = stat.rate / 26;
                        let totalF = y * 26;
                        let prinFVBase = stat.currentVal * Math.pow(1 + stat.rate, y);
                        let contribFVBase = stat.rate === 0 ? (stat.fortnightlyContribution * totalF) : (stat.fortnightlyContribution * ( (Math.pow(1 + r_f, totalF) - 1) / r_f ));
                        yearTotalBase += (prinFVBase + contribFVBase);

                        // SCENARIO COMPOUNDING (User Custom Track)
                        let periodsPerYear = scenFreq === 'Weekly' ? 52 : scenFreq === 'Fortnightly' ? 26 : scenFreq === 'Monthly' ? 12 : 1;
                        let r_s = stat.rate / periodsPerYear;
                        let totalS = y * periodsPerYear;
                        let scenContribPerPeriod = stat.annualScenContribution / periodsPerYear;
                        
                        let prinFVScen = stat.currentVal * Math.pow(1 + stat.rate, y);
                        let contribFVScen = stat.rate === 0 ? (scenContribPerPeriod * totalS) : (scenContribPerPeriod * ( (Math.pow(1 + r_s, totalS) - 1) / r_s ));
                        yearTotalScen += (prinFVScen + contribFVScen);
                    }
                });
                dataPointsBase.push((yearTotalBase || 0).toFixed(2));
                dataPointsScen.push((yearTotalScen || 0).toFixed(2));
            }
            
            if(invProjectionChartInstance) invProjectionChartInstance.destroy();
            
            let chartDatasets = [{
                label: 'Proven Habit (Baseline) ($)',
                data: dataPointsBase,
                borderColor: scenEnabled ? '#64748b' : '#10b981',
                borderDash: scenEnabled ? [5, 5] : [],
                backgroundColor: scenEnabled ? 'transparent' : 'rgba(16, 185, 129, 0.1)',
                fill: !scenEnabled,
                tension: 0.2,
                borderWidth: 2
            }];

            if(scenEnabled) {
                chartDatasets.push({
                    label: 'What-If Scenario Track ($)',
                    data: dataPointsScen,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.2,
                    borderWidth: 3
                });
            }

            const canvasCtx = ctx.getContext('2d');
invProjectionChartInstance = new Chart(canvasCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: chartDatasets
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    scales: { 
                        y: { grid: { color: isDark ? '#334155' : '#e2e8f0' } }, 
                        x: { grid: { display: false } } 
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let value = context.raw || 0;
                                    return '$' + Number(value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                                }
                            }
                        }
                    }
                }
            });
        }

        function addScenario() { const name = document.getElementById('scen-name').value.trim(); const amount = parseFloat(document.getElementById('scen-amount').value); const type = document.getElementById('scen-type').value; const date = document.getElementById('scen-date').value; if(!name || isNaN(amount) || !date) return alert("Fill all fields."); db.scenarios.push({ id: generateId(), name, amount, type, date, active: true }); document.getElementById('scen-name').value = ''; document.getElementById('scen-amount').value = ''; save(); }
        function toggleScenario(id) { let s = db.scenarios.find(x => x.id === id); if(s) s.active = !s.active; save(); }
        function removeScenario(id) { db.scenarios = db.scenarios.filter(x => x.id !== id); save(); }

        function addPlannerTask() { const desc = document.getElementById('task-desc').value.trim(); const priority = document.getElementById('task-priority').value; const date = document.getElementById('task-date').value; if(!desc) return alert("Task descriptions cannot be empty."); db.tasks.push({ id: generateId(), desc, priority, date, completed: false }); document.getElementById('task-desc').value = ''; save(); }
        function toggleTask(id) { let t = db.tasks.find(x => x.id === id); if(t) t.completed = !t.completed; save(); }
        function removeTask(id) { db.tasks = db.tasks.filter(x => x.id !== id); save(); }

        function editBudgetItem(id) { let b = db.budgetItems.find(x => x.id === id); if(!b) return; editingBudId = id; document.getElementById('b-category').value = b.category || ''; document.getElementById('b-name').value = b.name; document.getElementById('b-amount').value = b.amount; document.getElementById('b-freq').value = b.freq; document.getElementById('b-date').value = b.date || ''; document.getElementById('b-allowance').checked = b.isAllowance || false; document.getElementById('b-submit-btn').innerText = "Update"; document.getElementById('b-submit-btn').className = "btn accent"; document.getElementById('b-cancel-btn').style.display = "inline-block"; openTab('budget'); }
        function editIncome(id) { let i = db.incomes.find(x => x.id === id); if(!i) return; editingIncId = id; document.getElementById('i-category').value = i.category || ''; document.getElementById('i-name').value = i.name; document.getElementById('i-amount').value = i.amount; document.getElementById('i-freq').value = i.freq; document.getElementById('i-submit-btn').innerText = "Update"; document.getElementById('i-submit-btn').className = "btn accent"; document.getElementById('i-cancel-btn').style.display = "inline-block"; openTab('budget'); }
        function cancelEdit(type) { if(type === 'budget') { editingBudId = null; document.getElementById('b-category').value = ''; document.getElementById('b-name').value = ''; document.getElementById('b-amount').value = ''; document.getElementById('b-allowance').checked = false; document.getElementById('b-submit-btn').innerText = "Add"; document.getElementById('b-cancel-btn').style.display = "none"; document.getElementById('b-submit-btn').className = "btn accent"; } if(type === 'income') { editingIncId = null; document.getElementById('i-category').value = ''; document.getElementById('i-name').value = ''; document.getElementById('i-amount').value = ''; document.getElementById('i-submit-btn').innerText = "Add"; document.getElementById('i-cancel-btn').style.display = "none"; document.getElementById('i-submit-btn').className = "btn success"; } }

        function editAccount(id) {
            let acc = db.accounts.find(a => a.id === id);
            if (!acc) return;
            editingAccId = id;
            document.getElementById('acc-name').value = acc.name;
            document.getElementById('acc-start').value = acc.startBal || 0;
            let submitBtn = document.getElementById('acc-submit-btn');
            submitBtn.innerText = 'Update';
            submitBtn.className = 'btn accent';
            document.getElementById('acc-cancel-btn').style.display = 'inline-block';
        }

        function cancelAccEdit() {
            editingAccId = null;
            document.getElementById('acc-name').value = '';
            document.getElementById('acc-start').value = '';
            let submitBtn = document.getElementById('acc-submit-btn');
            submitBtn.innerText = 'Add';
            submitBtn.className = 'btn success';
            document.getElementById('acc-cancel-btn').style.display = 'none';
        }

        function addAccount() { 
            const name = document.getElementById('acc-name').value; 
            const startBal = parseFloat(document.getElementById('acc-start').value) || 0; 
            if(!name) return; 
            
            if (editingAccId) {
                let acc = db.accounts.find(a => a.id === editingAccId);
                if (acc) {
                    acc.name = name;
                    acc.startBal = startBal;
                }
                cancelAccEdit();
            } else {
                db.accounts.push({ id: generateId(), name, startBal }); 
            }
            document.getElementById('acc-name').value = ''; 
            document.getElementById('acc-start').value = ''; 
            save(); 
        }
        
        function delAccount(id) { showConfirm("Delete Account", "Are you sure?", () => { db.accounts = db.accounts.filter(a => a.id !== id); save(); }); }
        
        function addIncome() { 
            const cat = document.getElementById('i-category').value.trim() || 'General'; 
            const name = document.getElementById('i-name').value.trim(); 
            const amount = parseFloat(document.getElementById('i-amount').value); 
            const freq = document.getElementById('i-freq').value; 
            if(!name || isNaN(amount)) return alert("Fill all fields."); 
            
            if(editingIncId) { 
                let i = db.incomes.find(x => x.id === editingIncId); 
                i.category = cat; i.name = name; i.amount = amount; i.freq = freq; 
                cancelEdit('income'); 
            } else { 
                db.incomes.push({ id: generateId(), category: cat, name, amount, freq }); 
            } 
            
            if(!db.categories.find(c => c.name.toLowerCase() === cat.toLowerCase())) {
                db.categories.push({ id: generateId(), name: cat }); 
            }
            
            document.getElementById('i-category').value = ''; 
            document.getElementById('i-name').value = ''; 
            document.getElementById('i-amount').value = ''; 
            save(); 
        }
        function removeIncome(id) { showConfirm("Delete Income?", "Remove this income source?", () => { db.incomes = db.incomes.filter(i => i.id !== id); save(); }); }
        
        function addBudgetItem() { 
            const cat = document.getElementById('b-category').value.trim() || 'General'; const name = document.getElementById('b-name').value; const amount = parseFloat(document.getElementById('b-amount').value); const freq = document.getElementById('b-freq').value; const date = document.getElementById('b-date').value; const isAllowance = document.getElementById('b-allowance').checked;
            if(!name || isNaN(amount)) return alert("Fill all fields."); 
            if(editingBudId) { let b = db.budgetItems.find(x => x.id === editingBudId); b.category = cat; b.name = name; b.amount = amount; b.freq = freq; b.date = date; b.isAllowance = isAllowance; cancelEdit('budget'); } 
            else { db.budgetItems.push({ id: generateId(), category: cat, name, amount, freq, date, isAllowance, allowance: 0 }); } 
            if(!db.categories.find(c => c.name.toLowerCase() === cat.toLowerCase())) db.categories.push({ id: generateId(), name: cat }); 
            document.getElementById('b-category').value = ''; document.getElementById('b-name').value = ''; document.getElementById('b-amount').value = ''; document.getElementById('b-allowance').checked = false; save(); 
        }
        function removeBudgetItem(id) { showConfirm("Delete Item?", "Remove this from your budget?", () => { db.budgetItems = db.budgetItems.filter(b => b.id !== id); save(); }); }
        
        function fundAllowance(id) {
            const amt = parseFloat(prompt("Add funds to this allowance (use negative to remove): $"));
            if(!isNaN(amt)) { const b = db.budgetItems.find(x => x.id === id); if(b) { b.allowance += amt; save(); } }
        }

/* --- STEP 30: REFINED ACCOUNT TRANSFERS (TIMEZONE FIX) --- */
        function transferFunds() { 
            const fromId = document.getElementById('transfer-from').value; 
            const toId = document.getElementById('transfer-to').value; 
            const amt = parseFloat(document.getElementById('transfer-amount').value); 
            
            // 1. Strict Validation
            if(!fromId || !toId) return alert("Error: Please select both a 'From' and 'To' account.");
            if(isNaN(amt) || amt <= 0) return alert("Error: Transfer amount must be greater than zero."); 
            if(fromId === toId) return alert("Error: Cannot transfer money to the exact same account."); 
            
            // 2. Use the local timezone date (fixes the UTC midnight bug)
            const dateStr = getLocalDateStr(); 
            const tId = generateId(); 
            
            // 3. Create the linked pair (isTransfer: true ensures this doesn't skew your expense charts)
            db.transactions.push({ id: tId + '_out', date: dateStr, desc: 'Transfer Out', type: 'Expense', catId: 'transfer', accountId: fromId, amount: amt, isTransfer: true }); 
            db.transactions.push({ id: tId + '_in', date: dateStr, desc: 'Transfer In', type: 'Income', catId: 'transfer', accountId: toId, amount: amt, isTransfer: true }); 
            
            // 4. Clean up UI and notify user
            document.getElementById('transfer-amount').value = ''; 
            alert(`Success! $${amt.toFixed(2)} transferred successfully.`); 
            save(); 
        }
                
/* --- STEP 28: STRICT LEDGER VALIDATION --- */
        function addTransaction() { 
            const date = document.getElementById('tx-date').value; 
            const desc = document.getElementById('tx-desc').value.trim(); // .trim() removes accidental spaces 
            const type = document.getElementById('tx-type').value; 
            const catId = document.getElementById('tx-category').value; 
            const accountId = document.getElementById('tx-account').value; 
            const amount = parseFloat(document.getElementById('tx-amount').value); 
            
            // The Strict Validation Gates: specific, helpful errors!
            if(!date) return alert("Error: Please select a valid date.");
            if(!desc) return alert("Error: Description cannot be empty.");
            if(!accountId) return alert("Error: Please select a bank account. Have you created one in the Dashboard yet?");
            if(!catId) return alert("Error: Please select a category.");
            if(isNaN(amount) || amount <= 0) return alert("Error: Amount must be a valid number greater than zero.");
            
            if (editingTxId) { 
                const i = db.transactions.findIndex(t => t.id === editingTxId); 
                if (i !== -1) db.transactions[i] = { id: editingTxId, date, desc, type, catId, accountId, amount, isTransfer: false }; 
                
                editingTxId = null; 
                document.getElementById('tx-submit-btn').innerText = 'Log against Account'; 
                document.getElementById('tx-submit-btn').className = 'btn success'; 
                document.getElementById('tx-cancel-btn').style.display = 'none';
            } else { 
                db.transactions.push({ id: generateId(), date, desc, type, catId, accountId, amount, isTransfer: false }); 
            } 
            
            // Clean up the form after successful logging
            document.getElementById('tx-desc').value = ''; 
            document.getElementById('tx-amount').value = ''; 
            document.getElementById('tx-foreign-amt').value = ''; 
            document.getElementById('tx-foreign-rate').value = ''; 
            save(); 
        }

        function editTx(id) { 
            const tx = db.transactions.find(t => t.id === id); 
            if (!tx) return; 
            if(tx.isTransfer) return alert("Please delete and recreate transfers manually."); 
            
            editingTxId = id; 
            document.getElementById('tx-date').value = tx.date; 
            document.getElementById('tx-desc').value = tx.desc; 
            document.getElementById('tx-type').value = tx.type; 
            document.getElementById('tx-category').value = tx.catId; 
            document.getElementById('tx-account').value = tx.accountId; 
            document.getElementById('tx-amount').value = tx.amount; 
            
            document.getElementById('tx-foreign-toggle').checked = false;
            toggleTxForeign();
            
            document.getElementById('tx-submit-btn').innerText = 'Update'; 
            document.getElementById('tx-submit-btn').className = 'btn accent'; 
            document.getElementById('tx-cancel-btn').style.display = 'inline-block';
            
            openTab('transactions'); 
            document.getElementById('tx-form-container').scrollIntoView({ behavior: 'smooth' }); 
        }

        function cancelTxEdit() {
            editingTxId = null;
            document.getElementById('tx-date').value = getLocalDateStr();
            document.getElementById('tx-desc').value = '';
            document.getElementById('tx-type').value = 'Expense';
            document.getElementById('tx-amount').value = '';
            
            document.getElementById('tx-foreign-toggle').checked = false;
            toggleTxForeign();
            
            document.getElementById('tx-submit-btn').innerText = 'Log against Account';
            document.getElementById('tx-submit-btn').className = 'btn success';
            document.getElementById('tx-cancel-btn').style.display = 'none';
        }

        function removeTx(id) { showConfirm("Delete Transaction", "Are you sure?", () => { const tx = db.transactions.find(t => t.id === id); if(tx && tx.isTransfer) { let pairId = id.endsWith('_out') ? id.replace('_out', '_in') : id.replace('_in', '_out'); db.transactions = db.transactions.filter(t => t.id !== id && t.id !== pairId); } else { db.transactions = db.transactions.filter(t => t.id !== id); } save(); }); }
        function clearFilters() { document.getElementById('tx-search').value = ''; document.getElementById('tx-filter-cat').value = 'All'; document.getElementById('filter-start').value = ''; document.getElementById('filter-end').value = ''; render(); }
        function autoCategorize() { const desc = document.getElementById('tx-desc').value.toLowerCase().trim(); if(desc.length < 3) return; for(let i = db.transactions.length - 1; i >= 0; i--) { if(db.transactions[i].desc.toLowerCase().includes(desc) && !db.transactions[i].isTransfer) { document.getElementById('tx-category').value = db.transactions[i].catId; break; } } }
        function toggleTxForeign() { const isChecked = document.getElementById('tx-foreign-toggle').checked; document.getElementById('tx-foreign-fields').style.display = isChecked ? 'flex' : 'none'; document.getElementById('tx-amount').readOnly = isChecked; if(!isChecked) { document.getElementById('tx-foreign-amt').value = ''; document.getElementById('tx-foreign-rate').value = ''; } }
        function calcForeign() { const fAmt = parseFloat(document.getElementById('tx-foreign-amt').value) || 0; const rate = parseFloat(document.getElementById('tx-foreign-rate').value) || 1; document.getElementById('tx-amount').value = (fAmt * rate).toFixed(2); }

/* --- STEP 35: BULLETPROOF GOAL TRACKING & CONFETTI --- */
        function addGoal() { 
            const name = document.getElementById('goal-name').value.trim(); 
            const target = parseFloat(document.getElementById('goal-target').value); 
            if(!name || isNaN(target) || target <= 0) return alert("Error: Please enter a valid name and target amount."); 
            
            db.goals.push({ id: generateId(), name, target, current: 0 }); 
            document.getElementById('goal-name').value = ''; 
            document.getElementById('goal-target').value = ''; 
            save(); 
        }

        function fundGoal(id) {
            let input = prompt("Enter amount to add (use a minus sign to remove, e.g. -20):");
            if (input === null || input.trim() === '') return; // Safely exit if user cancels or leaves blank
            
            let amt = parseFloat(input);
            if (isNaN(amt)) return alert("Error: Please enter a valid number.");
            
            const g = db.goals.find(x => x.id === id);
            if (g) {
                g.current += amt;
                if (g.current < 0) g.current = 0; // Prevent the goal from dropping below $0
                
                // Trigger confetti only if they are adding money and hit the target!
                if (g.current >= g.target && amt > 0) {
                    triggerConfetti();
                }
                
                save();
            }
        }

        function deleteGoal(id) { 
            showConfirm("Delete Goal?", "This permanently removes the goal.", () => { 
                db.goals = db.goals.filter(g => g.id !== id); 
                save(); 
            }); 
        }
        
        function addDebt() { const name = document.getElementById('d-name').value.trim(); const bal = parseFloat(document.getElementById('d-bal').value); const apr = parseFloat(document.getElementById('d-apr').value); const min = parseFloat(document.getElementById('d-min').value); if(!name || isNaN(bal) || isNaN(apr) || isNaN(min)) return alert("Fill all fields."); db.debts.push({ id: generateId(), name, bal, apr, min }); document.getElementById('d-name').value = ''; document.getElementById('d-bal').value = ''; document.getElementById('d-apr').value = ''; document.getElementById('d-min').value = ''; save(); }
        function removeDebt(id) { showConfirm("Delete Debt?", "Remove from planner?", () => { db.debts = db.debts.filter(d => d.id !== id); save(); }); }
        function simulateDebt() { if(db.debts.length === 0) { document.getElementById('payoff-result').innerText = "Add debts to project."; return; } const strat = document.querySelector('input[name="d-strat"]:checked').value; const extraPmt = parseFloat(document.getElementById('d-extra').value) || 0; let simDebts = JSON.parse(JSON.stringify(db.debts)); let months = 0; let totalInterest = 0; while(simDebts.length > 0 && months < 360) { months++; if(strat === 'avalanche') simDebts.sort((a,b) => b.apr - a.apr); else simDebts.sort((a,b) => a.bal - b.bal); let extraAvailable = extraPmt; for(let i=0; i<simDebts.length; i++) { let d = simDebts[i]; let interest = d.bal * (d.apr / 100 / 12); totalInterest += interest; d.bal += interest; let pmt = Math.min(d.min, d.bal); d.bal -= pmt; } let targetIdx = 0; while(extraAvailable > 0 && simDebts.length > 0 && targetIdx < simDebts.length) { let d = simDebts[targetIdx]; let pmt = Math.min(extraAvailable, d.bal); d.bal -= pmt; extraAvailable -= pmt; if(d.bal <= 0.01) targetIdx++; } simDebts = simDebts.filter(d => d.bal > 0.01); } const res = document.getElementById('payoff-result'); if(months >= 360) res.innerText = "Payments too low."; else { let d = new Date(); d.setMonth(d.getMonth() + months); res.innerText = `Debt Free By: ${d.toLocaleString('default', { month: 'long', year: 'numeric' })}. Interest: $${totalInterest.toFixed(2)}`; } }

        function recordCatalogItem() { const name = document.getElementById('g-db-name').value.trim(); const market = document.getElementById('g-db-market').value.trim(); const price = parseFloat(document.getElementById('g-db-price').value); if(!name || !market || isNaN(price)) return alert("Complete item specs."); const dateStr = new Date().toISOString().split('T')[0]; let item = db.catalog.find(i => i.name.toLowerCase() === name.toLowerCase() && i.market.toLowerCase() === market.toLowerCase()); if(item) item.history.push({ date: dateStr, price: price }); else db.catalog.push({ id: generateId(), name, market, history: [{ date: dateStr, price }] }); document.getElementById('g-db-name').value = ''; document.getElementById('g-db-price').value = ''; save(); }
        function addDropdownItemToList() { const catalogId = document.getElementById('g-dropdown-select').value; const match = db.catalog.find(c => c.id === catalogId); if(!match) return; const latestPrice = match.history[match.history.length - 1].price; db.activeList.push({ id: generateId(), name: match.name, market: match.market, price: latestPrice, checked: false }); save(); }
        function toggleGroceryCheck(id) { const item = db.activeList.find(i => i.id === id); if(item) item.checked = !item.checked; save(); }
        function clearGotGroceries() { db.activeList = db.activeList.filter(i => !i.checked); save(); }
        function removeActiveListItem(id) { db.activeList = db.activeList.filter(i => i.id !== id); save(); }
        function removeCatalogItem(id) { showConfirm("Delete Item", "Remove item from database?", () => { db.catalog = db.catalog.filter(c => c.id !== id); save(); }); }

/* --- STEP 37: OCR SCANNER OPTIMIZATION --- */
        async function processReceiptDetailed() {
            const fileInput = document.getElementById('receipt-img'); 
            if(!fileInput.files.length) return alert("Select an image first.");
            
            const statusEl = document.getElementById('ocr-status'); 
            const resContainer = document.getElementById('ocr-results'); 
            const itemsBody = document.getElementById('ocr-items-body');
            
            // UX Polish 1: Grab the button to disable it during the scan
            const btn = event.currentTarget || document.querySelector('button[onclick="processReceiptDetailed()"]');
            if (btn) { btn.disabled = true; btn.innerText = "⏳ Scanning..."; }
            
            statusEl.style.color = "var(--text-main)";
            statusEl.innerText = "Extracting text... this may take a few seconds on mobile."; 
            resContainer.style.display = 'none'; 
            itemsBody.innerHTML = '';
            
            try {
                // The AI Engine reads the image
                const result = await Tesseract.recognize(fileInput.files[0], 'eng'); 
                const lines = result.data.text.split('\n'); 
                let foundItems = [];
                const ignoreWords = ['total', 'subtotal', 'tax', 'gst', 'cash', 'change', 'visa', 'mastercard', 'eftpos', 'savings', 'balance', 'amount', 'due'];
                
                lines.forEach(line => { 
                    // Improved Regex: Catches prices even if the AI misreads '$' as 'S' or '5'
                    let priceMatch = line.match(/(?:[\$S5])?\s*(\d+\.\d{2})/);
                    if (priceMatch) {
                        let price = parseFloat(priceMatch[1]); 
                        let rawName = line.substring(0, priceMatch.index).trim();
                        let cleanName = rawName.replace(/^[\d\W]+/, '').replace(/[^\w\s\-\%\.]/g, '').trim();
                        let shouldIgnore = ignoreWords.some(w => cleanName.toLowerCase().includes(w));
                        
                        // If it looks like a valid item, save it!
                        if (cleanName.length > 2 && !shouldIgnore && price > 0) {
                            foundItems.push({ name: cleanName, price: price });
                        }
                    }
                });
                
                if(foundItems.length > 0) {
                    statusEl.style.color = "var(--success)";
                    statusEl.innerText = `✓ Found ${foundItems.length} items! Verify and add to catalog:`; 
                    resContainer.style.display = 'block';
                    
                    foundItems.forEach((item, index) => { 
                        itemsBody.innerHTML += `<tr id="ocr-row-${index}">
                            <td><input type="text" id="ocr-name-${index}" value="${item.name}" style="padding:4px; font-size:0.85rem; width:100%;"></td>
                            <td>$<input type="number" id="ocr-price-${index}" value="${item.price.toFixed(2)}" step="0.01" style="padding:4px; font-size:0.85rem; width:70px;"></td>
                            <td><button class="btn accent" style="padding:4px 8px; width:auto;" onclick="addOcrToCatalog(${index})">+</button></td>
                        </tr>`; 
                    });
                } else {
                    statusEl.style.color = "var(--warning)";
                    statusEl.innerText = "No itemized lines detected clearly. Try alternative lighting angles.";
                }
            } catch (error) { 
                statusEl.style.color = "var(--danger)";
                statusEl.innerText = "Error executing receipt OCR. Ensure you have internet access for the Tesseract engine."; 
            } finally {
                // UX Polish 2: Re-enable the button once the scan is finished or fails
                if (btn) { btn.disabled = false; btn.innerText = "Extract Items"; }
            }
        }

        function addOcrToCatalog(index) {
            const name = document.getElementById(`ocr-name-${index}`).value.trim(); const price = parseFloat(document.getElementById(`ocr-price-${index}`).value); const market = prompt("Store Name for this item?", "Store");
            if(market && name && !isNaN(price)) {
                const dateStr = new Date().toISOString().split('T')[0]; db.catalog.push({ id: generateId(), name, market, history: [{ date: dateStr, price }] });
                document.getElementById(`ocr-row-${index}`).style.opacity = '0.3'; document.querySelector(`#ocr-row-${index} button`).disabled = true; save();
            }
        }

        // --- MASTER RENDER RE-ENGINEER ---
/* --- STEP 38 (PART 2): THE PRIVACY MASK POLISH --- */
        function applyPrivacyMask() {
            const masked = "🔒 Hidden";
            
            // 1. Mask Dashboard & Summary Cards with a lock icon
            ['dash-assets', 'dash-investments', 'dash-debt-display', 'dash-networth', 'budget-income-display', 'budget-expense-display', 'budget-actual-display', 'budget-remaining-display', 'budget-variance-display', 'grocery-total', 'stock-dash-invested', 'stock-dash-value', 'stock-dash-growth', 'finv-dash-value'].forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    el.innerText = masked;
                    el.style.color = "var(--text-muted)";
                }
            });
            
            // 2. Hide specific text areas securely
            if(document.getElementById('payoff-result')) document.getElementById('payoff-result').innerText = "🔒 Privacy Mode";
            if(document.getElementById('sweeper-advice')) document.getElementById('sweeper-advice').innerText = "🔒 Auto-sweeper locked for privacy.";
            if(document.getElementById('sweeper-bars')) document.getElementById('sweeper-bars').innerHTML = '';
            if(document.getElementById('goals-container')) document.getElementById('goals-container').innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted);">🔒 Goals securely hidden.</div>';
            if(document.getElementById('sync-status')) document.getElementById('sync-status').innerText = '🔒 Funding Schedule Hidden';
            
            // 3. Mask all table bodies with a professional locked message
            const tbodys = ['accounts-body', 'upcoming-payments-body', 'income-body', 'budget-body', 'scenario-body', 'tx-body', 'planner-body', 'stocks-body', 'stock-lots-body', 'finv-body', 'debt-body', 'g-list-body', 'g-catalog-body'];
            tbodys.forEach(id => {
                const tbody = document.getElementById(id);
                if(tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-muted); padding:3rem; font-style:italic; font-size:1.1rem;">🔒 Data securely hidden.<br><span style="font-size:0.85rem;">Click 'Unhide Data' in Settings to view.</span></td></tr>`;
            });
            
            // 4. Destroy charts so they don't leak visual wealth data
            if(dashChart) dashChart.destroy();
            if(insightBar) insightBar.destroy();
            if(insightLine) insightLine.destroy();
            if(forecastChartInstance) forecastChartInstance.destroy();
            if(invProjectionChartInstance) invProjectionChartInstance.destroy();
        }
/* --- PRO MODE OPTIMIZATION: FAST ACCOUNT BALANCES --- */
        function getOptimizedBalances() {
            let balances = {};
            let total = 0;
            // 1. Set starting balances
            db.accounts.forEach(a => balances[a.id] = parseFloat(a.startBal) || 0);
            // 2. Add/subtract all transactions in one single pass
            db.transactions.forEach(t => {
                if(balances[t.accountId] !== undefined) {
                    let amt = parseFloat(t.amount) || 0;
                    balances[t.accountId] += (t.type === 'Income' ? amt : -amt);
                }
            });
            // 3. Sum up the grand total
            for (let id in balances) total += balances[id];
            return { balances, total };
        }
        function render() {
            document.getElementById('privacy-toggle-btn').innerText = db.settings.privacyMode ? 'Unhide Data' : 'Hide My Data (Privacy Mode)';

            let catOpts = '<option value="transfer">Inter-Account Transfer</option>';
            db.categories.forEach(c => {
                catOpts += `<optgroup label="${c.name}">`;
                catOpts += `<option value="${c.id}">General ${c.name}</option>`;
                db.budgetItems.filter(b => b.category === c.name).forEach(b => { catOpts += `<option value="${b.id}">${b.name}</option>`; });
                catOpts += `</optgroup>`;
            });
            document.querySelectorAll('.cat-dropdown').forEach(sel => sel.innerHTML = catOpts);
            
            const accOpts = db.accounts.length ? db.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('') : '<option value="" disabled>Add an account first</option>';
            document.querySelectorAll('.acc-dropdown').forEach(sel => sel.innerHTML = accOpts);
            document.getElementById('tx-filter-cat').innerHTML = '<option value="All">All Categories</option>' + db.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
            const invBuySelect = document.getElementById('stock-buy-asset');
            if (invBuySelect) {
                invBuySelect.innerHTML = db.stocks.length ? db.stocks.map(i => `<option value="${i.id}">${i.name}</option>`).join('') : '<option value="" disabled>Add an asset first</option>';
            }

            if (db.settings.privacyMode) {
                applyPrivacyMask();
                return;
            }

            const searchQ = document.getElementById('tx-search').value.toLowerCase(); const filterCat = document.getElementById('tx-filter-cat').value;
            const filterStart = document.getElementById('filter-start').value; const filterEnd = document.getElementById('filter-end').value;
            let filteredTx = [...db.transactions].sort((a,b) => new Date(b.date) - new Date(a.date));
            if(filterCat !== 'All') {
                filteredTx = filteredTx.filter(t => {
                    const matchBud = db.budgetItems.find(b => b.id === t.catId);
                    if(matchBud) { const parentCat = db.categories.find(c => c.name === matchBud.category); return parentCat && parentCat.id === filterCat; }
                    return t.catId === filterCat;
                });
            }
            if(searchQ) filteredTx = filteredTx.filter(t => t.desc.toLowerCase().includes(searchQ) || t.amount.toString().includes(searchQ));
            if(filterStart) filteredTx = filteredTx.filter(t => t.date >= filterStart);
            if(filterEnd) filteredTx = filteredTx.filter(t => t.date <= filterEnd);

            const txBody = document.getElementById('tx-body'); txBody.innerHTML = '';
            filteredTx.forEach(t => {
                let matchBud = db.budgetItems.find(b => b.id === t.catId);
                let matchCat = db.categories.find(c => c.id === t.catId);
                const cName = t.isTransfer ? 'Transfer' : (t.type === 'Income' ? 'Income' : (matchBud ? matchBud.name : (matchCat ? matchCat.name : 'Misc')));
                txBody.innerHTML += `<tr><td>${fDate(t.date)}</td><td><strong>${t.desc}</strong><br><span class="badge">${cName}</span></td><td class="${t.type === 'Income' ? 'text-success' : 'text-danger'}">${t.type === 'Income'?'+':'-'}$${t.amount.toFixed(2)}</td><td><div class="action-btns"><button class="btn accent" onclick="editTx('${t.id}')">Edit</button><button class="btn danger" onclick="removeTx('${t.id}')">X</button></div></td></tr>`;
            });

// Apply Pro Mode Fast Math
            const optimized = getOptimizedBalances();
            let totalAccountsBal = optimized.total; 
            
            const aBody = document.getElementById('accounts-body'); 
            if(aBody) aBody.innerHTML = '';
            db.accounts.forEach(a => {
                let aBal = optimized.balances[a.id] || 0;
                if(aBody) aBody.innerHTML += `<tr><td><strong>${a.name}</strong></td><td>$${aBal.toFixed(2)}</td><td><div class="action-btns"><button class="btn accent" style="padding:4px 8px; width:auto;" onclick="editAccount('${a.id}')">Edit</button><button class="btn danger" style="padding:4px 8px; width:auto;" onclick="delAccount('${a.id}')">X</button></div></td></tr>`;
            });

            // Render Lots Sub-table
            renderStockLots();

            let totalStockInvested = 0;
            let totalStockValue = 0;
            const stocksBody = document.getElementById('stocks-body'); 
            if(stocksBody) stocksBody.innerHTML = '';
            
            db.stocks.forEach(i => { 
                let assetInvested = 0;
                let assetUnits = 0;
                if(i.lots) {
                    i.lots.forEach(lot => {
                        let u = parseFloat(lot.units) || 0;
                        let c = parseFloat(lot.costPerUnit) || 0;
                        assetUnits += u;
                        assetInvested += (u * c);
                    });
                }
                
                let currentP = parseFloat(i.currentPrice) || 0;
                let assetValue = assetUnits * currentP;
                totalStockInvested += assetInvested;
                totalStockValue += assetValue;
                
                let growthAmt = assetValue - assetInvested;
                let growthPerc = assetInvested > 0 ? (growthAmt / assetInvested) * 100 : 0;
                let colorCls = growthAmt >= 0 ? 'text-success' : 'text-danger';
                let sign = growthAmt >= 0 ? '+' : '';
                let avgCost = assetUnits > 0 ? (assetInvested / assetUnits) : 0;

                if(stocksBody) {
                    stocksBody.innerHTML += `<tr>
                        <td><strong>${i.name}</strong><br><span class="badge">${i.type}</span></td>
                        <td>${assetUnits.toFixed(4)} Units<br><span style="font-size:0.8rem; color:var(--text-muted);">Avg: $${avgCost.toFixed(2)}</span></td>
                        <td>$${currentP.toFixed(2)}</td>
                        <td><strong>$${assetValue.toFixed(2)}</strong></td>
                        <td class="${colorCls}">${sign}$${growthAmt.toFixed(2)} <br><span style="font-size:0.8rem;">(${sign}${growthPerc.toFixed(1)}%)</span></td>
                        <td><div class="action-btns"><button class="btn accent" style="padding:4px 8px; width:auto;" onclick="editStock('${i.id}')">Edit</button><button class="btn danger" style="padding:4px 8px; width:auto;" onclick="removeStock('${i.id}')">X</button></div></td>
                    </tr>`; 
                }
            });

            const totalStockGrowth = totalStockValue - totalStockInvested;
            const totalStockGrowthPerc = totalStockInvested > 0 ? (totalStockGrowth / totalStockInvested) * 100 : 0;
            
            if(document.getElementById('stock-dash-value')) document.getElementById('stock-dash-value').innerText = `$${totalStockValue.toFixed(2)}`;
            if(document.getElementById('stock-dash-invested')) document.getElementById('stock-dash-invested').innerText = `$${totalStockInvested.toFixed(2)}`;
            if(document.getElementById('stock-dash-growth')) {
                let el = document.getElementById('stock-dash-growth');
                el.innerText = `${totalStockGrowth >= 0 ? '+' : ''}$${totalStockGrowth.toFixed(2)} (${totalStockGrowth >= 0 ? '+' : ''}${totalStockGrowthPerc.toFixed(1)}%)`;
                el.className = totalStockGrowth >= 0 ? 'text-success' : 'text-danger';
            }

            let totalFlatInvValue = 0;
            const finvBody = document.getElementById('finv-body');
            if (finvBody) finvBody.innerHTML = '';
            
            db.investments.forEach(i => {
                let v = parseFloat(i.val) || 0;
                totalFlatInvValue += v;
                if(finvBody) {
                    finvBody.innerHTML += `<tr>
                        <td><strong>${i.name}</strong></td>
                        <td><span class="badge">${i.type}</span></td>
                        <td>$${v.toFixed(2)}</td>
                        <td><div class="action-btns"><button class="btn accent" style="padding:4px 8px; width:auto;" onclick="editFlatInv('${i.id}')">Edit</button><button class="btn danger" style="padding:4px 8px; width:auto;" onclick="removeFlatInv('${i.id}')">X</button></div></td>
                    </tr>`;
                }
            });
            if(document.getElementById('finv-dash-value')) document.getElementById('finv-dash-value').innerText = `$${totalFlatInvValue.toFixed(2)}`;

/* --- STEP 36: DEBT TABLE UI AUDIT --- */
            const dBody = document.getElementById('debt-body');
            if (dBody) {
                dBody.innerHTML = '';
                if (db.debts.length === 0) {
                    dBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No debts logged. You are debt-free! 🎉</td></tr>`;
                } else {
                    db.debts.forEach(d => {
                        dBody.innerHTML += `<tr>
                            <td><strong>${d.name}</strong></td>
                            <td>$${d.bal.toFixed(2)}</td>
                            <td><span class="badge" style="background:var(--danger); color:white;">${d.apr}%</span></td>
                            <td>$${d.min.toFixed(2)}/mo</td>
                            <td><button class="btn danger" style="padding:4px 8px; width:auto;" onclick="removeDebt('${d.id}')">X</button></td>
                        </tr>`;
                    });
                }
            }

            let totalDebt = db.debts.reduce((s,d) => s + (parseFloat(d.bal) || 0), 0);
            
/* --- STEP 46: PREMIUM CURRENCY FORMATTING --- */
            document.getElementById('dash-assets').innerText = '$' + totalAccountsBal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            document.getElementById('dash-investments').innerText = '$' + (totalStockValue + totalFlatInvValue).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            document.getElementById('dash-debt-display').innerText = '$' + totalDebt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            document.getElementById('dash-networth').innerText = '$' + (totalAccountsBal + totalStockValue + totalFlatInvValue - totalDebt).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

            const upcomingBody = document.getElementById('upcoming-payments-body');
            if (upcomingBody) {
                upcomingBody.innerHTML = '';
                const todayStr = getLocalDateStr();
                
                let upcomingItems = db.budgetItems.filter(b => {
                    if (!b.date || b.isAllowance) return false;
                    let cycleStart = retreatDateStr(b.date, b.freq);
                    let paidThisCycle = db.transactions.filter(t => t.catId === b.id && t.type === 'Expense' && !t.isTransfer && t.date >= cycleStart && t.date <= b.date).reduce((s,t) => s+t.amount, 0);
                    return paidThisCycle === 0;
                }).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 10);
                
                if (upcomingItems.length === 0) {
                    upcomingBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No upcoming payments scheduled.</td></tr>`;
                } else {
                    upcomingItems.forEach(b => {
                        let collected = calculateTargetSaved(b.amount, b.freq, b.date);
                        let dateColor = 'inherit';
                        if (b.date < todayStr) { 
                            dateColor = 'var(--danger)'; 
                        } else if (new Date(b.date + 'T00:00:00') <= new Date(new Date().getTime() + 7 * 86400000)) { 
                            dateColor = 'var(--warning)'; 
                        }
                        upcomingBody.innerHTML += `<tr><td><strong>${b.name}</strong><br><span class="badge">${b.category}</span></td><td>$${b.amount.toFixed(2)}</td><td class="text-success"><strong>$${collected.toFixed(2)}</strong></td><td style="color:${dateColor}; font-weight:bold;">${fDate(b.date)}</td></tr>`;
                    });
                }
            }

            const scenBody = document.getElementById('scenario-body');
            if (scenBody) {
                scenBody.innerHTML = '';
                if(db.scenarios.length === 0) scenBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No scenarios built yet. Add one above!</td></tr>`;
                db.scenarios.forEach(s => {
                    let typeLabel = s.type === 'one_expense' ? 'One-Time Expense' : s.type === 'one_income' ? 'One-Time Windfall' : s.type === 'on_expense' ? 'Ongoing Expense (/fn)' : 'Ongoing Income (/fn)';
                    let colorCls = (s.type.includes('income')) ? 'text-success' : 'text-danger'; let sign = s.type.includes('income') ? '+' : '-';
                    scenBody.innerHTML += `<tr style="${!s.active ? 'opacity:0.5;' : ''}"><td><input type="checkbox" ${s.active ? 'checked' : ''} onclick="toggleScenario('${s.id}')" style="width:20px; height:20px; cursor:pointer;"></td><td><strong>${s.name}</strong><br><span class="badge">${typeLabel}</span></td><td class="${colorCls}"><strong>${sign}$${s.amount.toFixed(2)}</strong></td><td>${fDate(s.date)}</td><td><button class="btn danger" style="padding:4px 8px; width:auto;" onclick="removeScenario('${s.id}')">X</button></td></tr>`;
                });
            }

           const currentSyncFreq = db.settings.syncFreq || 'Daily';
const shortSyncLabel = currentSyncFreq === 'Weekly' ? 'wk' : currentSyncFreq === 'Fortnightly' ? 'fn' : currentSyncFreq === 'Monthly' ? 'mo' : 'day';

// Dynamically update labels
if(document.getElementById('card-income-title')) document.getElementById('card-income-title').innerText = `${currentSyncFreq} Pay`;
if(document.getElementById('th-income-equiv')) document.getElementById('th-income-equiv').innerText = `${currentSyncFreq} Equivalent`;

let expectedIncome = 0; const incBody = document.getElementById('income-body'); incBody.innerHTML = '';
const incGroups = {};
db.incomes.forEach(inc => { let cat = inc.category || 'General'; if(!incGroups[cat]) incGroups[cat] = { items: [], totalSync: 0 }; incGroups[cat].items.push(inc); incGroups[cat].totalSync += getSyncEquivalent(inc.amount, inc.freq, currentSyncFreq); });
for(let cat in incGroups) {
    let group = incGroups[cat]; expectedIncome += group.totalSync;
    incBody.innerHTML += `<tr style="background-color: var(--secondary); color: white;"><td colspan="3"><strong>${cat}</strong></td><td colspan="2"><strong>$${group.totalSync.toFixed(2)} / ${shortSyncLabel}</strong></td></tr>`;
    group.items.forEach(inc => { let syncInc = getSyncEquivalent(inc.amount, inc.freq, currentSyncFreq); incBody.innerHTML += `<tr><td>${inc.name}</td><td>$${inc.amount.toFixed(2)}</td><td><span class="badge">${inc.freq}</span></td><td class="text-success"><strong>$${syncInc.toFixed(2)}</strong></td><td><div class="action-btns"><button class="btn accent" onclick="editIncome('${inc.id}')">Edit</button><button class="btn danger" onclick="removeIncome('${inc.id}')">X</button></div></td></tr>`; });
}

            let totalSyncCost = 0; const bBody = document.getElementById('budget-body'); bBody.innerHTML = '';
const expGroups = {};

db.budgetItems.forEach(b => { 
    let cat = b.category || 'General'; 
    if(!expGroups[cat]) expGroups[cat] = { items: [], totalSync: 0, totalTarget: 0 }; 
    expGroups[cat].items.push(b); 
    expGroups[cat].totalSync += getSyncEquivalent(b.amount, b.freq, currentSyncFreq); 
});
            
            let activeVariance = 0;

            for(let cat in expGroups) {
                let group = expGroups[cat]; totalSyncCost += group.totalSync;
                let catObj = db.categories.find(c => c.name.toLowerCase() === cat.toLowerCase());
                
                let cycleDays = 14; let cycleLabel = '14d';
                let freqs = group.items.map(i => i.freq);
                if(freqs.includes('Annually')) { cycleDays = 365; cycleLabel = '365d'; }
                else if(freqs.includes('Half-Yearly')) { cycleDays = 182; cycleLabel = '6mo'; }
                else if(freqs.includes('Quarterly')) { cycleDays = 90; cycleLabel = '90d'; }
                else if(freqs.includes('Monthly')) { cycleDays = 30; cycleLabel = '30d'; }
                
                let targetForCycle = 0;
                group.items.forEach(b => {
                    let daily = 0;
                    if(b.freq === 'Weekly') daily = b.amount / 7;
                    if(b.freq === 'Fortnightly') daily = b.amount / 14;
                    if(b.freq === 'Monthly') daily = b.amount / 30;
                    if(b.freq === 'Quarterly') daily = b.amount / 90;
                    if(b.freq === 'Half-Yearly') daily = b.amount / 182;
                    if(b.freq === 'Annually') daily = b.amount / 365;
                    targetForCycle += daily * cycleDays;
                });

                let actualSpend = 0;
                if(catObj) { 
                    actualSpend = db.transactions.filter(t => 
                        (t.catId === catObj.id || group.items.some(bi => bi.id === t.catId)) 
                        && t.type === 'Expense' && !t.isTransfer && isWithinLastXDays(t.date, cycleDays)
                    ).reduce((s, t) => s + t.amount, 0); 
                }
                
                let perc = targetForCycle > 0 ? (actualSpend / targetForCycle) * 100 : 0;
                let barColor = perc > 100 ? 'var(--danger)' : (perc > 80 ? 'var(--warning)' : 'var(--success)');
                
                bBody.innerHTML += `<tr style="background-color: var(--secondary); color: white;"><td colspan="3"><div style="display:flex; justify-content:space-between; margin-bottom:4px;"><strong>${cat}</strong><span style="font-size:0.85rem; opacity:0.9;">Spend: $${actualSpend.toFixed(2)} / $${targetForCycle.toFixed(2)} (${cycleLabel})</span></div><div class="goal-bar-bg" style="height:6px; margin:0; background:rgba(255,255,255,0.2); border:none;"><div class="goal-bar-fill" style="width:${Math.min(perc, 100)}%; background:${barColor};"></div></div></td><td><strong>Target: $${group.totalSync.toFixed(2)} / ${shortSyncLabel}</strong></td><td></td><td colspan="2" class="text-success" style="vertical-align:bottom;"><strong>Target Saved: $<span id="group-target-${cat.replace(/\s+/g, '-')}">0.00</span></strong></td></tr>`;
                
                let groupTargetTotal = 0;

                group.items.forEach(b => { 
                    let syncCost = getSyncEquivalent(b.amount, b.freq, currentSyncFreq); 
                    let targetSavedHtml = '';
                    let targetSaved = 0;
                    let actionHtml = `<button class="btn accent" onclick="editBudgetItem('${b.id}')">Edit</button><button class="btn danger" onclick="removeBudgetItem('${b.id}')">X</button>`;
                    
                    if (b.isAllowance) {
                        let itemAllTimeSpend = 0;
                        db.transactions.filter(t => t.catId === b.id && !t.isTransfer).forEach(t => {
                            itemAllTimeSpend += (t.type === 'Expense' ? t.amount : -t.amount);
                        });
                        
                        targetSaved = b.allowance - itemAllTimeSpend;
                        let badgeColor = targetSaved < 0 ? 'var(--danger)' : 'var(--success)';
                        
                        targetSavedHtml = `<td><span class="badge" style="background:${badgeColor}; color:white;">Available: $${targetSaved.toFixed(2)}</span></td>`;
                        actionHtml = `<button class="btn success" style="padding:4px 8px; width:auto;" onclick="fundAllowance('${b.id}')">+$</button>` + actionHtml;
                    } else {
                        let cycleStart = retreatDateStr(b.date, b.freq);
                        let paidThisCycle = db.transactions.filter(t => t.catId === b.id && t.type === 'Expense' && !t.isTransfer && t.date >= cycleStart && t.date <= b.date).reduce((s, t) => s + t.amount, 0);
                        
                        if (paidThisCycle > 0) {
                            let variance = b.amount - paidThisCycle;
                            activeVariance += variance;
                            targetSaved = 0; 
                            
                            let vText = variance > 0 ? `Saved $${variance.toFixed(2)}` : (variance < 0 ? `Lost $${Math.abs(variance).toFixed(2)}` : `Paid Exact`);
                            let vColor = variance >= 0 ? 'var(--success)' : 'var(--danger)';
                            targetSavedHtml = `<td><span class="badge" style="background:${vColor}; color:white;">Paid: ${vText}</span></td>`;
                        } else {
                            targetSaved = calculateTargetSaved(b.amount, b.freq, b.date);
                            targetSavedHtml = `<td class="text-success">$${targetSaved.toFixed(2)}</td>`;
                        }
                    }

                    groupTargetTotal += targetSaved;
                    bBody.innerHTML += `<tr><td>${b.name}</td><td>$${b.amount.toFixed(2)}</td><td><span class="badge">${b.freq}</span></td><td><strong>$${syncCost.toFixed(2)}</strong></td><td>${fDate(b.date) || 'N/A'}</td>${targetSavedHtml}<td><div class="action-btns">${actionHtml}</div></td></tr>`;
                });
                
                let gtEl = document.getElementById(`group-target-${cat.replace(/\s+/g, '-')}`);
                if (gtEl) gtEl.innerText = groupTargetTotal.toFixed(2);
            }

            let vCard = document.getElementById('variance-card');
            let vDisplay = document.getElementById('budget-variance-display');
            if(vCard && vDisplay) {
                vCard.className = 'card ' + (activeVariance >= 0 ? 'success' : 'danger');
                vDisplay.innerText = (activeVariance >= 0 ? '+$' : '-$') + Math.abs(activeVariance).toFixed(2);
                vDisplay.style.color = activeVariance >= 0 ? 'var(--success)' : 'var(--danger)';
            }

            let totalActualSpend = db.transactions.filter(t => t.type === 'Expense' && !t.isTransfer && isWithinLastXDays(t.date, 14)).reduce((s, t) => s + t.amount, 0);
           let unallocated = expectedIncome - totalSyncCost;
document.getElementById('budget-expense-display').innerText = `$${totalSyncCost.toFixed(2)}`;
            document.getElementById('budget-remaining-display').innerText = `$${unallocated.toFixed(2)}`;

            const sweeperPanel = document.getElementById('auto-sweeper-panel');
            if (sweeperPanel) {
                sweeperPanel.style.display = 'block';
                const adviceEl = document.getElementById('sweeper-advice'); const barsEl = document.getElementById('sweeper-bars');
                if (unallocated <= 0) {
                    adviceEl.innerHTML = `<strong>Status Red:</strong> You have no unallocated cash this fortnight. Focus on reducing discretionary structural costs or increasing income before optimizing capital deployment.`;
                    barsEl.innerHTML = '';
                } else {
                    let remainingCash = unallocated; let deployment = [];
                    let toxicDebts = db.debts.filter(d => d.bal > 0 && d.apr > 7).sort((a, b) => b.apr - a.apr);
                    let activeGoals = db.goals.filter(g => g.current < g.target);
                    let lowDebts = db.debts.filter(d => d.bal > 0 && d.apr <= 7).sort((a, b) => b.apr - a.apr);

                    if (toxicDebts.length > 0) {
                        let toDebt = Math.min(remainingCash * 0.8, toxicDebts.reduce((sum, d) => sum + d.bal, 0));
                        let toGoals = remainingCash - toDebt; 
                        adviceEl.innerHTML = `<strong>Status Yellow (Toxic Debt Detected):</strong> You have <strong>$${unallocated.toFixed(2)}</strong> unallocated. Mathematically, your highest yield is eliminating your ${toxicDebts[0].apr}% APR ${toxicDebts[0].name}. We recommend an 80/20 split to aggressively kill debt while maintaining cash-saving momentum.`;
                        if (toDebt > 0) deployment.push({ name: `Kill Debt (${toxicDebts[0].name})`, amount: toDebt, color: 'var(--danger)' });
                        if (activeGoals.length > 0 && toGoals > 0) deployment.push({ name: `Fund Goal (${activeGoals[0].name})`, amount: toGoals, color: 'var(--success)' });
                        else if (toGoals > 0) deployment.push({ name: `Market Investments`, amount: toGoals, color: 'var(--accent)' });
                    } else if (activeGoals.length > 0) {
                        let toGoals = Math.min(remainingCash * 0.7, activeGoals.reduce((sum, g) => sum + (g.target - g.current), 0));
                        let toInvest = remainingCash - toGoals;
                        adviceEl.innerHTML = `<strong>Status Green (Wealth Building):</strong> You have <strong>$${unallocated.toFixed(2)}</strong> unallocated and zero high-interest debt! Deploying heavily into your Sinking Funds secures your short-term liabilities, freeing up the rest for market investments.`;
                        if (toGoals > 0) deployment.push({ name: `Fund Goal (${activeGoals[0].name})`, amount: toGoals, color: 'var(--success)' });
                        if (toInvest > 0) {
                            if (lowDebts.length > 0) deployment.push({ name: `Low-APR Debt (${lowDebts[0].name})`, amount: toInvest, color: 'var(--warning)' });
                            else deployment.push({ name: `Market Investments`, amount: toInvest, color: 'var(--accent)' });
                        }
                    } else {
                        adviceEl.innerHTML = `<strong>Status Blue (Maximum Optimization):</strong> Goals are funded. Debts are cleared. 100% of your <strong>$${unallocated.toFixed(2)}</strong> unallocated cash should be swept into wealth-generating assets to maximize compound growth.`;
                        deployment.push({ name: `Market Investments`, amount: remainingCash, color: 'var(--accent)' });
                    }

                    let barHtml = '<div style="display:flex; height:24px; border-radius:12px; overflow:hidden; border:1px solid var(--border);">';
                    let legendHtml = '<div style="display:flex; gap:1rem; margin-top:0.5rem; font-size:0.85rem; flex-wrap:wrap;">';
                    deployment.forEach(d => {
                        let perc = (d.amount / unallocated) * 100;
                        barHtml += `<div style="width:${perc}%; background:${d.color};" title="${d.name}: $${d.amount.toFixed(2)}"></div>`;
                        legendHtml += `<div style="display:flex; align-items:center; gap:0.25rem;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${d.color};"></span><strong>${d.name}:</strong> $${d.amount.toFixed(2)}</div>`;
                    });
                    barHtml += '</div>'; legendHtml += '</div>'; barsEl.innerHTML = barHtml + legendHtml;
                }
            }

/* --- STEP 32: SMART PLANNER SORTING --- */
            const pBody = document.getElementById('planner-body');
            if (pBody) { 
                pBody.innerHTML = ''; 
                if(db.tasks.length === 0) {
                    pBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No priority agenda items logged. Add one above!</td></tr>`; 
                } else {
                    // 1. Assign weight values to priorities
                    const pWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
                    
                    // 2. Create a smart-sorted copy of the tasks
                    let sortedTasks = [...db.tasks].sort((a, b) => {
                        // Rule A: Completed tasks instantly drop to the bottom
                        if (a.completed !== b.completed) return a.completed ? 1 : -1;
                        // Rule B: Sort the remaining tasks by High -> Medium -> Low
                        return (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
                    });

                    // 3. Render the newly sorted list
                    sortedTasks.forEach(t => { 
                        let pColor = t.priority === 'High' ? 'var(--danger)' : t.priority === 'Medium' ? 'var(--warning)' : 'var(--success)'; 
                        pBody.innerHTML += `<tr style="${t.completed ? 'text-decoration:line-through; opacity:0.4;' : ''}"><td><input type="checkbox" ${t.completed ? 'checked' : ''} onclick="toggleTask('${t.id}')" style="width:20px; height:20px; cursor:pointer;"></td><td><strong>${t.desc}</strong></td><td><span class="badge" style="color:${pColor}; border-color:${pColor}; font-weight:bold;">${t.priority}</span></td><td>${fDate(t.date) || 'No Target Date'}</td><td><button class="btn danger" style="padding:4px 8px; width:auto;" onclick="removeTask('${t.id}')">X</button></td></tr>`; 
                    }); 
                }
            }

            const gCont = document.getElementById('goals-container'); gCont.innerHTML = '';
            db.goals.forEach(g => { 
                const perc = g.target > 0 ? Math.min((g.current / g.target)*100, 100) : 0; 
                gCont.innerHTML += `<div class="card" style="border-top-color: var(--success);"><div style="display:flex; justify-content:space-between; align-items:center;"><h3>${g.name}</h3><button class="btn danger" style="padding:2px 8px; width:auto;" onclick="deleteGoal('${g.id}')">X</button></div><p>$${g.current.toFixed(2)} <span style="font-size:0.9rem; color:var(--text-muted);">/ $${g.target.toFixed(2)}</span></p><div class="goal-bar-bg"><div class="goal-bar-fill" style="width:${perc}%;"></div></div><button class="btn success" style="margin-top:1rem; padding:0.5rem;" onclick="fundGoal('${g.id}')">Manual Fund</button></div>`; 
            });

            const gDropdown = document.getElementById('g-dropdown-select'); gDropdown.innerHTML = '';
            db.catalog.forEach(c => { const latest = c.history[c.history.length - 1].price; gDropdown.innerHTML += `<option value="${c.id}">${c.name} (${c.market}) - $${latest.toFixed(2)}</option>`; });
            const catSearch = (document.getElementById('cat-search')?.value || '').toLowerCase(); const catBody = document.getElementById('g-catalog-body');
            if (catBody) { 
                catBody.innerHTML = ''; let filteredCat = db.catalog; 
                if(catSearch) filteredCat = filteredCat.filter(c => c.name.toLowerCase().includes(catSearch) || c.market.toLowerCase().includes(catSearch)); 
                filteredCat.forEach(c => { 
                    const latest = c.history[c.history.length - 1].price; let historyString = c.history.map(h => `$${h.price.toFixed(2)}`).join(' → '); 
                    catBody.innerHTML += `<tr><td><strong>${c.name}</strong><br><span class="badge">${c.market}</span></td><td><strong>$${latest.toFixed(2)}</strong></td><td><span style="font-size:0.75rem; color:var(--text-muted);">${historyString}</span></td><td><button class="btn danger" style="padding:2px 8px;" onclick="removeCatalogItem('${c.id}')">X</button></td></tr>`; 
                }); 
            }
            
/* --- STEP 34: SMART GROCERY CART SORTING --- */
            const glBody = document.getElementById('g-list-body');
            if (glBody) { 
                glBody.innerHTML = ''; 
                let gTotal = 0; 
                
                if (db.activeList.length === 0) {
                    glBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Your shopping list is empty. Add items from the catalog!</td></tr>`;
                } else {
                    // Smart Sort: Unchecked items at the top, Checked items dropped to the bottom
                    let sortedGroceries = [...db.activeList].sort((a, b) => {
                        if (a.checked === b.checked) return 0; // Keep original order if they are both checked or unchecked
                        return a.checked ? 1 : -1; // Push checked items down
                    });
                    
                    sortedGroceries.forEach(i => { 
                        // Only add UNCHECKED items to the live total!
                        if(!i.checked) gTotal += i.price; 
                        
                        glBody.innerHTML += `<tr style="${i.checked ? 'text-decoration:line-through; opacity:0.4; background-color:rgba(0,0,0,0.05);' : ''}">
                            <td><input type="checkbox" ${i.checked ? 'checked':''} onclick="toggleGroceryCheck('${i.id}')" style="width:20px; height:20px; cursor:pointer;"></td>
                            <td><strong>${i.name}</strong><br><span class="badge">${i.market}</span></td>
                            <td>$${i.price.toFixed(2)}</td>
                            <td><button class="btn danger" style="padding:4px 8px;" onclick="removeActiveListItem('${i.id}')">X</button></td>
                        </tr>`; 
                    }); 
                }
                
                const gTotalEl = document.getElementById('grocery-total'); 
                if (gTotalEl) gTotalEl.innerText = `$${gTotal.toFixed(2)}`; 
            }

            const syncStatus = document.getElementById('sync-status');
            if (syncStatus) {
                if (db.settings.syncFreq === 'Daily') {
                    syncStatus.innerText = "Status: Target Saved updates continuously every day.";
                } else {
                    let effDate = getEffectiveToday();
                    syncStatus.innerText = `Status: Target Saved steps up in exact multiples based on your pay schedule.`;
                }
            }

            if (document.getElementById('dashboard').classList.contains('active')) renderCharts(filteredTx);
            if (document.getElementById('insights').classList.contains('active')) renderInsightsCharts();
            if (document.getElementById('forecast').classList.contains('active')) renderForecastChart();
            if (document.getElementById('stocks').classList.contains('active')) renderInvProjectionChart();
            if (document.getElementById('planner').classList.contains('active')) renderPlannerModule();
        }

        function renderCharts(filteredTx = null) { 
            if (db.settings.privacyMode) return;
            const isDark = db.settings.theme === 'dark'; Chart.defaults.color = isDark ? '#94a3b8' : '#64748b'; 
            if (document.getElementById('dashboard').classList.contains('active') && filteredTx) { 
                const expenseMap = {}; 
                filteredTx.filter(t => t.type === 'Expense' && !t.isTransfer).forEach(t => { 
                    const name = resolveCategoryName(t.catId); expenseMap[name] = (expenseMap[name] || 0) + t.amount; 
                }); 
                const ctx1 = document.getElementById('dashChart').getContext('2d'); 
                if(dashChart) dashChart.destroy(); 
                dashChart = new Chart(ctx1, { type: 'doughnut', data: { labels: Object.keys(expenseMap), datasets: [{ data: Object.values(expenseMap), backgroundColor: ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#38bdf8', '#ec4899'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } }); 
            } 
        }

        function renderInsightsCharts() { 
            if (db.settings.privacyMode) return;
            const isDark = db.settings.theme === 'dark'; Chart.defaults.color = isDark ? '#94a3b8' : '#64748b'; 
            
            const expenseMap = {}; 
            db.transactions.filter(t => t.type === 'Expense' && !t.isTransfer).forEach(t => { 
                const name = resolveCategoryName(t.catId); expenseMap[name] = (expenseMap[name] || 0) + t.amount; 
            }); 
            const ctxBar = document.getElementById('insightBarChart').getContext('2d'); 
            if(insightBar) insightBar.destroy(); 
            insightBar = new Chart(ctxBar, { type: 'bar', data: { labels: Object.keys(expenseMap), datasets: [{ label: 'Total Spent', data: Object.values(expenseMap), backgroundColor: '#8b5cf6' }] }, options: { responsive: true, maintainAspectRatio: false } }); 
            
            const monthsMap = {}; const today = new Date(); 
            for(let i=5; i>=0; i--) { 
                let d = new Date(today.getFullYear(), today.getMonth()-i, 1); 
                monthsMap[`${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`] = { inc: 0, exp: 0 }; 
            } 
            db.transactions.forEach(t => { 
                if(t.isTransfer) return; 
                let parts = t.date.split('-');
                const m = `${parts[1]}/${parts[0]}`; 
                if(monthsMap[m]) { if(t.type === 'Income') monthsMap[m].inc += t.amount; else monthsMap[m].exp += t.amount; } 
            }); 
            const ctxLine = document.getElementById('insightLineChart').getContext('2d'); 
            if(insightLine) insightLine.destroy(); 
            insightLine = new Chart(ctxLine, { type: 'line', data: { labels: Object.keys(monthsMap), datasets: [ { label: 'Income', data: Object.values(monthsMap).map(m=>m.inc), borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.3 }, { label: 'Expense', data: Object.values(monthsMap).map(m=>m.exp), borderColor: '#ef4444', backgroundColor: 'transparent', tension: 0.3 } ] }, options: { responsive: true, maintainAspectRatio: false } }); 
        }

        function generateId() { return Math.random().toString(36).substr(2, 9); }
        function openTab(tabId) { 
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.tab-link').forEach(el => el.classList.remove('active')); 
    document.getElementById(tabId).classList.add('active'); 
    
    // Safely check for event to prevent ReferenceErrors
    if(typeof event !== 'undefined' && event && event.currentTarget) {
        event.currentTarget.classList.add('active'); 
    } else {
        document.querySelector(`button[onclick*="openTab('${tabId}')"]`)?.classList.add('active'); 
    }
    
    if(tabId === 'dashboard') renderCharts(); 
    if(tabId === 'insights') renderInsightsCharts(); 
    if(tabId === 'debt') simulateDebt(); 
    if(tabId === 'forecast') renderForecastChart(); 
    if(tabId === 'planner') render(); 
    if(tabId === 'stocks') renderInvProjectionChart();
}
        function showConfirm(title, text, callback) { document.getElementById('modal-title').innerText = title; document.getElementById('modal-text').innerText = text; confirmAction = callback; document.getElementById('modal-confirm-btn').onclick = () => { if(confirmAction) confirmAction(); closeModal(); }; document.getElementById('modal-overlay').style.display = 'flex'; }
        function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; confirmAction = null; }
        function applyTheme() { document.documentElement.setAttribute('data-theme', db.settings.theme); document.getElementById('theme-toggle-btn').innerText = db.settings.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'; }
        function toggleTheme() { db.settings.theme = db.settings.theme === 'light' ? 'dark' : 'light'; save(); applyTheme(); renderCharts(); if(document.getElementById('insights').classList.contains('active')) renderInsightsCharts(); if(document.getElementById('forecast').classList.contains('active')) renderForecastChart(); if(document.getElementById('stocks').classList.contains('active')) renderInvProjectionChart(); }
        
/* --- STEP 33: SMART BACKUP VERSIONING --- */
        async function exportJSON() { 
            const jsonStr = JSON.stringify(db, null, 2);
            
            // Generate a professional timestamp (e.g., 2026-09-01_14-30)
            const d = new Date();
            const datePart = getLocalDateStr();
            const timePart = String(d.getHours()).padStart(2, '0') + '-' + String(d.getMinutes()).padStart(2, '0');
            const fileName = `Accountant_Monty_${datePart}_${timePart}.json`;
            
            // Try modern File System Access API
            if (window.showSaveFilePicker) {
                try {
                    // Only ask for a new file handle if we don't have one, OR if we want to force a new timestamp
                    // Pro Mode: We force a new save window every time to ensure the new timestamp is used!
                    fileHandle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{ description: 'JSON File', accept: {'application/json': ['.json']} }]
                    });
                    
                    const writable = await fileHandle.createWritable();
                    await writable.write(jsonStr);
                    await writable.close();
                    
                    unsavedChanges = false;
                    localStorage.setItem('Monty_NeedsBackup', 'false');
                    updateBackupUI();
                    alert("Master backup saved securely!");
                    return;
                } catch (err) {
                    console.log("File System API cancelled or failed, falling back to download.");
                }
            }
            
            // Standard fallback download (For iOS and older browsers)
            const blob = new Blob([jsonStr], { type: 'application/json' }); 
            const a = document.createElement('a'); 
            a.href = URL.createObjectURL(blob); 
            a.download = fileName; 
            document.body.appendChild(a); // Required for Firefox
            a.click(); 
            document.body.removeChild(a); // Clean up the DOM
            
            unsavedChanges = false;
            localStorage.setItem('Monty_NeedsBackup', 'false');
            updateBackupUI();
        }

 /* --- STEP 23: SECURE IMPORT REBOOT --- */
        function importJSON() { 
            const file = document.getElementById('import-json-file').files[0]; 
            if(!file) return alert("Select a backup file first."); 
            
            showConfirm("Restore Backup?", "This will overwrite all current data. Are you sure?", () => { 
                const reader = new FileReader(); 
                reader.onload = e => { 
                    try { 
                        db = JSON.parse(e.target.result); 
                        save(); // Saves the restored data to your phone
                        alert("Data successfully restored! Monty will now reboot."); 
                        window.location.reload(); // Forces a clean refresh to prevent visual bugs
                    } catch(err) { 
                        alert("Error: Invalid backup file."); 
                    } 
                }; 
                reader.readAsText(file); 
            }); 
        }
        
        function triggerConfetti() { 
            const canvas = document.getElementById('confetti-canvas'); canvas.style.display = 'block'; 
            const ctx = canvas.getContext('2d'); canvas.width = window.innerWidth; canvas.height = window.innerHeight; 
            let particles = []; 
            for(let i=0; i<100; i++) particles.push({ x: canvas.width/2, y: canvas.height/2, r: Math.random()*6+2, dx: Math.random()*10-5, dy: Math.random()*-10-2, color: `hsl(${Math.random()*360}, 100%, 50%)` }); 
            function animate() { 
                ctx.clearRect(0,0,canvas.width,canvas.height); 
                particles.forEach(p => { p.x += p.dx; p.y += p.dy; p.dy += 0.2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fillStyle = p.color; ctx.fill(); }); 
                if(particles.some(p => p.y < canvas.height)) requestAnimationFrame(animate); else canvas.style.display = 'none'; 
            } animate(); 
        }

        window.onload = load;


        /* --- STEP 42: SERVICE WORKER REGISTRATION (PWA) --- */
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(registration => {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(err => {
                        console.error('ServiceWorker registration failed: ', err);
                    });
            });
        }

        /* --- STEP 43: PWA INSTALL PROMPT --- */
        let deferredPrompt;
        const installBtn = document.getElementById('install-btn');

        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later
            deferredPrompt = e;
            // Show the custom install button!
            if (installBtn) installBtn.style.display = 'inline-block';
        });

        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    // Show the native browser install prompt
                    deferredPrompt.prompt();
                    // Wait for the user to respond
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response to install: ${outcome}`);
                    // We've used the prompt, so throw it away
                    deferredPrompt = null;
                    // Hide the button since they either installed it or rejected it
                    installBtn.style.display = 'none';
                }
            });
        }

        /* --- STEP 44: OFFLINE INDICATOR --- */
        function updateOnlineStatus() {
            const offlineBanner = document.getElementById('offline-banner');
            if (offlineBanner) {
                // If the browser is offline, show the banner. Otherwise, hide it.
                offlineBanner.style.display = navigator.onLine ? 'none' : 'block';
            }
        }

        // Listen for the browser connecting or disconnecting
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        
        // Run it once when the app loads just to check the current status
        updateOnlineStatus();

/* --- STEP 45: CACHE BUSTER (FORCE UPDATE) --- */
        function forceUpdateApp() {
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => {
                        caches.delete(name);
                    });
                }).then(() => {
                    alert("App cache cleared! Monty will now download the latest version.");
                    window.location.reload(true);
                });
            } else {
                // Fallback for older browsers
                window.location.reload(true);
            }
        }    
        /* --- STEP 47: FACTORY RESET (LAUNCH PREP) --- */
        function factoryReset() {
            showConfirm("⚠️ COMPLETE DATA WIPE", "Are you absolutely sure? This will permanently delete all accounts, transactions, and settings. You cannot undo this.", () => {
                // Nuke all the storage keys
                localStorage.removeItem('AccountantMontyV6_Data');
                localStorage.removeItem('Monty_Drafts');
                localStorage.removeItem('Monty_NeedsBackup');
                
                alert("Database erased. Monty is rebooting to a clean slate.");
                
                // Force a hard cache reload to clear everything from memory
                window.location.reload(true);
            });
        }   
        
        /* --- STEP 50: WEEKLY TIMETABLE & PLANNER ENGINE --- */
        let currentWeekOffset = 0;
        let plannerViewMode = 'live';

        function togglePlannerView(mode) {
            plannerViewMode = mode;
            const liveBtn = document.getElementById('view-live-btn');
            const defBtn = document.getElementById('view-default-btn');
            const liveView = document.getElementById('planner-live-view');
            const defView = document.getElementById('planner-default-view');

            if (mode === 'live') {
                liveBtn.className = 'btn accent';
                defBtn.className = 'btn';
                liveView.style.display = 'block';
                defView.style.display = 'none';
            } else {
                liveBtn.className = 'btn';
                defBtn.className = 'btn accent';
                liveView.style.display = 'none';
                defView.style.display = 'block';
            }
            render();
        }

        function changeWeekOffset(dir) {
            currentWeekOffset += dir;
            render();
        }

        function addDefaultRoutine() {
            const day = parseInt(document.getElementById('def-day').value);
            const time = document.getElementById('def-time').value;
            const desc = document.getElementById('def-desc').value.trim();

            if (!desc || !time) return alert("Please enter both a time and a routine description.");

            db.routine.push({ id: generateId(), day, time, desc });
            document.getElementById('def-desc').value = '';
            document.getElementById('def-time').value = '';
            save();
        }

        function removeDefaultRoutine(id) {
            db.routine = db.routine.filter(r => r.id !== id);
            save();
        }

        function addAppointment() {
            const date = document.getElementById('apt-date').value;
            const time = document.getElementById('apt-time').value;
            const desc = document.getElementById('apt-desc').value.trim();

            if (!date || !desc) return alert("Please select a date and description for the appointment.");

            db.appointments.push({ id: generateId(), date, time: time || 'All Day', desc });
            document.getElementById('apt-desc').value = '';
            document.getElementById('apt-time').value = '';
            save();
        }

        function removeAppointment(id) {
            db.appointments = db.appointments.filter(a => a.id !== id);
            save();
        }

        function skipRoutineInstance(dateStr, routineId) {
            const key = `${dateStr}_${routineId}`;
            if (!db.plannerHidden.includes(key)) {
                db.plannerHidden.push(key);
                save();
            }
        }

        function restoreRoutineInstance(dateStr, routineId) {
            const key = `${dateStr}_${routineId}`;
            db.plannerHidden = db.plannerHidden.filter(k => k !== key);
            save();
        }

        // Helper to get Monday-Sunday dates for the currently selected week offset
        function getDaysOfCurrentWeek() {
            let d = new Date();
            d.setHours(0,0,0,0);
            // Adjust to Monday of this week
            let day = d.getDay();
            let diff = d.getDate() - day + (day === 0 ? -6 : 1);
            let monday = new Date(d.setDate(diff));
            
            // Apply offset weeks
            monday.setDate(monday.getDate() + (currentWeekOffset * 7));

            let weekDays = [];
            const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            
            for (let i = 0; i < 7; i++) {
                let currentD = new Date(monday);
                currentD.setDate(monday.getDate() + i);
                let year = currentD.getFullYear();
                let month = String(currentD.getMonth() + 1).padStart(2, '0');
                let dayNum = String(currentD.getDate()).padStart(2, '0');
                let dateStr = `${year}-${month}-${dayNum}`;
                
                weekDays.push({
                    name: dayNames[i],
                    dateStr: dateStr,
                    displayDate: `${dayNum}/${month}/${year}`,
                    dayIndex: (i + 1) % 7 // Maps Monday=1 ... Sunday=0 matching JS getDay()
                });
            }
            return weekDays;
        }

        function renderPlannerModule() {
            // 1. Render Base Template View
            const defBody = document.getElementById('default-routine-body');
            if (defBody) {
                defBody.innerHTML = '';
                if (db.routine.length === 0) {
                    defBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No master routine items set yet.</td></tr>`;
                } else {
                    const dayMap = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 0: 'Sunday' };
                    let sortedRoutine = [...db.routine].sort((a,b) => a.day - b.day || a.time.localeCompare(b.time));
                    sortedRoutine.forEach(r => {
                        defBody.innerHTML += `<tr>
                            <td><strong>${dayMap[r.day]}</strong></td>
                            <td>${r.time}</td>
                            <td>${r.desc}</td>
                            <td><button class="btn danger" style="padding:4px 8px; width:auto;" onclick="removeDefaultRoutine('${r.id}')">X</button></td>
                        </tr>`;
                    });
                }
            }

            // 2. Render Live Week View
            const liveContainer = document.getElementById('live-week-container');
            const weekLabel = document.getElementById('current-week-label');
            if (liveContainer && weekLabel) {
                liveContainer.innerHTML = '';
                let weekDays = getDaysOfCurrentWeek();
                
                if (currentWeekOffset === 0) weekLabel.innerText = "This Week";
                else if (currentWeekOffset === 1) weekLabel.innerText = "Next Week";
                else if (currentWeekOffset === -1) weekLabel.innerText = "Last Week";
                else weekLabel.innerText = `Week of ${weekDays[0].displayDate}`;

                weekDays.forEach(wd => {
                    // Find standard routines for this day of the week
                    let dayRoutines = db.routine.filter(r => r.day === wd.dayIndex);
                    // Find one-off appointments for this exact date
                    let dayApts = db.appointments.filter(a => a.date === wd.dateStr);

                    let itemsHtml = '';

                    // Render Routine Items
                    dayRoutines.forEach(r => {
                        let isSkipped = db.plannerHidden.includes(`${wd.dateStr}_${r.id}`);
                        itemsHtml += `<div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-color); padding:0.75rem 1rem; border-radius:12px; margin-bottom:0.5rem; ${isSkipped ? 'opacity:0.4; text-decoration:line-through;' : ''}">
                            <div>
                                <span class="badge" style="margin-right:0.5rem;">${r.time}</span>
                                <strong>${r.desc}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(Base Routine)</span>
                            </div>
                            <div>
                                ${isSkipped ? 
                                    `<button class="btn accent" style="padding:2px 8px; font-size:0.8rem;" onclick="restoreRoutineInstance('${wd.dateStr}', '${r.id}')">Restore</button>` : 
                                    `<button class="btn danger" style="padding:2px 8px; font-size:0.8rem;" onclick="skipRoutineInstance('${wd.dateStr}', '${r.id}')">Skip this week</button>`
                                }
                            </div>
                        </div>`;
                    });

                    // Render One-off Appointments
                    dayApts.forEach(a => {
                        itemsHtml += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(139,92,246,0.08); padding:0.75rem 1rem; border-radius:12px; margin-bottom:0.5rem; border-left: 4px solid var(--accent);">
                            <div>
                                <span class="badge" style="background:var(--accent); color:white; margin-right:0.5rem;">${a.time}</span>
                                <strong>${a.desc}</strong> <span style="font-size:0.75rem; color:var(--accent); font-weight:bold;">(Appointment)</span>
                            </div>
                            <div>
                                <button class="btn danger" style="padding:2px 8px; font-size:0.8rem;" onclick="removeAppointment('${a.id}')">X</button>
                            </div>
                        </div>`;
                    });

                    if (!dayRoutines.length && !dayApts.length) {
                        itemsHtml = `<p style="color:var(--text-muted); font-size:0.9rem; font-style:italic; margin:0.5Rem 0;">No events scheduled.</p>`;
                    }

                    liveContainer.innerHTML += `<div style="background:var(--panel-bg); padding:1.2rem; border-radius:16px; box-shadow:var(--shadow);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">
                            <h4 style="margin:0; font-size:1.05rem; color:var(--accent);">${wd.name}</h4>
                            <span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">${wd.displayDate}</span>
                        </div>
                        <div>${itemsHtml}</div>
                    </div>`;
                });
            }
        }