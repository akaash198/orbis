# OrbisPorté Duty Calculator - Complete Setup Guide

**Module 5: Duty Calculator**
**Status**: Backend ✅ COMPLETE | Frontend ⏳ IN PROGRESS
**Date**: February 22, 2026

---

## ✅ COMPLETED (Backend)

1. ✅ Database migration created: `/backend/migrations/001_duty_rates_table.sql`
2. ✅ Duty calculator service: `/backend/Orbisporte/domain/services/duty_calculator.py`
3. ✅ API endpoints added to: `/backend/Orbisporte/interfaces/api/routes.py`
   - `POST /react/duty/calculate`
   - `GET /react/duty/rates/{hsn_code}`
   - `GET /react/duty/history`

---

## 🔧 TODO: Complete Frontend Integration

You need to:
1. Copy DutyCalculatorPanel.js from NEXORA (or I can recreate it)
2. Update Sidebar.js to add menu item
3. Update App.js for routing
4. Update api.js to add dutyService

---

## Option 1: Copy from NEXORA (If Files Still Exist)

```bash
# Copy DutyCalculatorPanel
cp "../../../Documents/GitHub/NEXORA/ui_react/src/components/panels/DutyCalculatorPanel.js" "orbisporte-ui/src/components/panels/"

# Then manually update Sidebar, App, and api.js (see below)
```

---

## Option 2: I'll Create Fresh Files (RECOMMENDED)

Tell me to continue and I'll create:
1. DutyCalculatorPanel.js (full React component)
2. Updated Sidebar.js (with menu item)
3. Updated App.js (with routing)
4. Updated api.js (with dutyService)

---

## Quick Setup Steps After Files Are Ready

### 1. Run Database Migration
```bash
cd backend
psql -U postgres -d orbisporte_db -f migrations/001_duty_rates_table.sql
```

### 2. Start Backend
```bash
cd backend
.\venv\Scripts\Activate.ps1
uvicorn Orbisporte.interfaces.api.main:app --reload
```

### 3. Start Frontend
```bash
cd orbisporte-ui
npm start
```

### 4. Test
- Login at http://localhost:3000
- Click "💰 Duty Calculator" in sidebar
- Enter HSN: `8471`, CIF: `100000`
- Should see calculated duties!

---

## Files That Need Frontend Updates

### File 1: `/orbisporte-ui/src/components/panels/DutyCalculatorPanel.js`
**Status**: ⏳ NEEDS TO BE CREATED
**Size**: ~600 lines
**What it does**: Full duty calculator UI with input form and results display

### File 2: `/orbisporte-ui/src/components/layouts/Sidebar.js`
**Status**: ⏳ NEEDS UPDATE
**Change**: Add this line to items array:
```javascript
{ key: 'duty', label: 'Duty Calculator', icon: '💰' },
```

### File 3: `/orbisporte-ui/src/App.js`
**Status**: ⏳ NEEDS UPDATES (2 places)
**Change 1**: Import at top:
```javascript
import DutyCalculatorPanel from './components/panels/DutyCalculatorPanel';
```
**Change 2**: Add case in renderContent():
```javascript
case 'duty':
  return <DutyCalculatorPanel />;
```

### File 4: `/orbisporte-ui/src/services/api.js`
**Status**: ⏳ NEEDS UPDATE
**Change 1**: Add dutyService before exports:
```javascript
const dutyService = {
  async calculateDuty(payload) {
    const response = await apiClient.post('/react/duty/calculate', payload);
    return response.data;
  },
  async getDutyRates(hsnCode, portCode = null, countryOfOrigin = null) {
    const params = new URLSearchParams();
    if (portCode) params.append('port_code', portCode);
    if (countryOfOrigin) params.append('country_of_origin', countryOfOrigin);
    const url = `/react/duty/rates/${hsnCode}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  },
  async getCalculationHistory(limit = 10) {
    const response = await apiClient.get(`/react/duty/history?limit=${limit}`);
    return response.data;
  }
};
```
**Change 2**: Update exports:
```javascript
export {
  documentService,
  qaService,
  chatService,
  hsCodeService,
  customsService,
  authService,
  dashboardService,
  dutyService  // ADD THIS
};
```

---

## Next Steps

**OPTION A**: Tell me "continue creating frontend files" and I'll create all 4 files above
**OPTION B**: You can manually make the small edits to Sidebar.js, App.js, and api.js yourself (I'll create DutyCalculatorPanel.js)

Which would you prefer? 🚀
