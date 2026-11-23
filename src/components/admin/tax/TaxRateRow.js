"use client";

import { Trash2 } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { inp } from "./taxStyles";
import ThemedSelect from "@/components/ui/ThemedSelect";

// One row of a WooCommerce-style tax rate table. Location fields left blank
// mean "matches any value" — see TaxSettings model for the full contract.
export default function TaxRateRow({ row, onChange, onDelete }) {
  return (
    <tr>
      <td style={{ minWidth: 170 }}>
        <ThemedSelect
          className="wp-select wp-full"
          value={row.country}
          onChange={(e) => onChange({ country: e.target.value })}
          aria-label="Country"
        >
          <option value="">* Any country</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </ThemedSelect>
      </td>
      <td style={{ minWidth: 130 }}>
        <input
          type="text"
          className={inp}
          value={row.state}
          onChange={(e) => onChange({ state: e.target.value })}
          placeholder="e.g. CA — blank = any state"
          aria-label="State code"
        />
      </td>
      <td style={{ minWidth: 170 }}>
        <input
          type="text"
          className={inp}
          value={row.postcode}
          onChange={(e) => onChange({ postcode: e.target.value })}
          placeholder="94103, 9410*, or 10000...19999 — blank = any"
          aria-label="Postcode / ZIP"
        />
      </td>
      <td style={{ minWidth: 130 }}>
        <input
          type="text"
          className={inp}
          value={row.city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="blank = any city"
          aria-label="City"
        />
      </td>
      <td style={{ minWidth: 100 }}>
        <div className="relative" style={{ width: 96 }}>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            className={`${inp} wp-num`}
            style={{ paddingRight: 22 }}
            value={row.rate}
            onChange={(e) => onChange({ rate: Number(e.target.value) })}
            aria-label="Rate %"
          />
          <span className="wp-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">%</span>
        </div>
      </td>
      <td style={{ minWidth: 120 }}>
        <input
          type="text"
          className={inp}
          value={row.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Tax"
          aria-label="Tax name"
        />
      </td>
      <td style={{ minWidth: 80 }}>
        <input
          type="number"
          min="0"
          title="Rows sharing a priority are summed together; a higher-priority compound row stacks on top."
          className={`${inp} wp-num`}
          style={{ width: 70 }}
          value={row.priority}
          onChange={(e) => onChange({ priority: Number(e.target.value) })}
          aria-label="Priority"
        />
      </td>
      <td className="text-center" style={{ verticalAlign: "middle" }}>
        <input
          type="checkbox"
          checked={!!row.compound}
          onChange={(e) => onChange({ compound: e.target.checked })}
          title="Calculate this rate on top of the subtotal plus already-applied simple taxes"
          aria-label="Compound"
        />
      </td>
      <td className="text-center" style={{ verticalAlign: "middle" }}>
        <input
          type="checkbox"
          checked={!!row.shipping}
          onChange={(e) => onChange({ shipping: e.target.checked })}
          title="Applies this rate to the shipping cost too"
          aria-label="Apply to shipping"
        />
      </td>
      <td className="text-center" style={{ verticalAlign: "middle" }}>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center min-w-[30px] min-h-[30px] max-[782px]:min-w-[40px] max-[782px]:min-h-[40px] rounded-[3px] bg-transparent border-0 text-[#b32d2e] hover:bg-[#fcf0f1] cursor-pointer"
          aria-label="Remove rate row"
          title="Remove row"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}
