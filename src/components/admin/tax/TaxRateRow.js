"use client";

import { Trash2 } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { inp } from "./taxStyles";

// One row of a WooCommerce-style tax rate table. Location fields left blank
// mean "matches any value" — see TaxSettings model for the full contract.
export default function TaxRateRow({ row, onChange, onDelete }) {
  return (
    <tr className="hover:bg-[#f0f6fb] border-b border-[#f0f0f1] last:border-0">
      <td className="px-2 py-2 align-top">
        <select
          className={`${inp} cursor-pointer`}
          value={row.country}
          onChange={(e) => onChange({ country: e.target.value })}
        >
          <option value="">* Any country</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="text"
          className={inp}
          value={row.state}
          onChange={(e) => onChange({ state: e.target.value })}
          placeholder="e.g. CA — blank = any state"
        />
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="text"
          className={inp}
          value={row.postcode}
          onChange={(e) => onChange({ postcode: e.target.value })}
          placeholder="94103, 9410*, or 10000...19999 — blank = any"
        />
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="text"
          className={inp}
          value={row.city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="blank = any city"
        />
      </td>
      <td className="px-2 py-2 align-top">
        <div className="relative w-[95px]">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            className={`${inp} pr-5 text-center font-semibold`}
            value={row.rate}
            onChange={(e) => onChange({ rate: Number(e.target.value) })}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#646970]">%</span>
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="text"
          className={inp}
          value={row.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Tax"
        />
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="number"
          min="0"
          title="Rows sharing a priority are summed together; a higher-priority compound row stacks on top."
          className={`${inp} w-[70px] text-center`}
          value={row.priority}
          onChange={(e) => onChange({ priority: Number(e.target.value) })}
        />
      </td>
      <td className="px-2 py-2 align-top text-center">
        <input
          type="checkbox"
          className="w-4 h-4 accent-[#2271b1]"
          checked={!!row.compound}
          onChange={(e) => onChange({ compound: e.target.checked })}
          title="Calculate this rate on top of the subtotal plus already-applied simple taxes"
        />
      </td>
      <td className="px-2 py-2 align-top text-center">
        <input
          type="checkbox"
          className="w-4 h-4 accent-[#2271b1]"
          checked={!!row.shipping}
          onChange={(e) => onChange({ shipping: e.target.checked })}
          title="Applies this rate to the shipping cost too"
        />
      </td>
      <td className="px-2 py-2 align-top text-center">
        <button
          type="button"
          onClick={onDelete}
          className="text-[#b32d2e] hover:text-[#d63638] p-1 rounded-[3px] hover:bg-[#fcf0f1] transition-colors cursor-pointer"
          aria-label="Delete rate row"
          title="Delete row"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
