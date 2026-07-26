const fields = [
  ["firstName", "First Name"],
  ["lastName", "Last Name"],
  ["registerNumber", "Register Number"],
  ["gender", "Gender"],
  ["dateOfBirth", "Date of Birth", "date"],
  ["bloodGroup", "Blood Group"],
  ["caste", "Caste"],
  ["aadharNumber", "Aadhar Number"],
  ["panNumber", "PAN Number"],
  ["phoneNumber", "Student Phone"],
  ["officialEmail", "Official Mail"],
  ["personalEmail", "Personal Mail"],
  ["fatherName", "Father Name"],
  ["fatherContactNumber", "Father Contact"],
  ["motherName", "Mother Name"],
  ["motherContactNumber", "Mother Contact"],
  ["permanentAddress", "Permanent Address"],
  ["presentAddress", "Present Address"],
  ["stateName", "State"],
  ["residencyType", "Hosteller or Day Scholar"],
  ["hostelBlockAndRoomNumber", "Hostel Block and Room Number"]
];

export default function StudentForm({ value, onChange, onSubmit, onCancel, saving }) {
  function update(field, nextValue) {
    onChange({ ...value, [field]: nextValue });
  }

  return (
    <form onSubmit={onSubmit} className="panel p-5">
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(([field, label, type = "text"]) => (
          <label key={field} className={field.includes("Address") ? "md:col-span-2" : ""}>
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
            {field === "gender" || field === "residencyType" ? (
              <select className="input" value={value[field] || ""} onChange={(event) => update(field, event.target.value)}>
                <option value="">Select</option>
                {(field === "gender" ? ["Male", "Female", "Other"] : ["Hosteller", "Day Scholar"]).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            ) : (
              <input
                type={type}
                className="input"
                value={type === "date" && value[field] ? String(value[field]).slice(0, 10) : value[field] || ""}
                onChange={(event) => update(field, event.target.value)}
                required={["firstName", "registerNumber"].includes(field)}
              />
            )}
          </label>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-3">
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Student"}</button>
      </div>
    </form>
  );
}
