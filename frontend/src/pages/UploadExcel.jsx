import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { supabase, mapStudentToSupabase } from "../lib/api";

const columnMap = {
  serialNo: ["sno", "sno.", "serialno", "s.no", "s.no.", "s no"],
  registerNumber: ["regno", "reg.no", "reg.no.", "register no", "register number", "registration number", "reg. no."],
  firstName: ["firstname", "first name", "student name", "name"],
  lastName: ["lastname", "last name", "surname"],
  gender: ["gender", "sex"],
  caste: ["caste", "community"],
  officialEmail: ["officialsrmmailid", "official srm mail id", "official mail", "college mail", "srm mail id"],
  phoneNumber: ["studentphonenumber", "student phone number", "phone number", "mobile number", "contact number"],
  bloodGroup: ["bloodgroup", "blood group"],
  aadharNumber: ["aadharnumber", "aadhar number", "aadhaar number"],
  panNumber: ["pannumber", "pan number"],
  dateOfBirth: ["dateofbirth", "date of birth", "dob"],
  permanentAddress: ["permanentaddress", "permanent address"],
  presentAddress: ["presentaddress", "present address", "current address"],
  stateName: ["statename", "state name", "state"],
  fatherName: ["fathername", "father name"],
  fatherContactNumber: ["fathercontactnumber", "father contact number", "father mobile", "father phone"],
  motherName: ["mothername", "mother name"],
  motherContactNumber: ["mothercontactnumber", "mother contact number", "mother mobile", "mother phone"],
  residencyType: ["hostellerordayscholar", "hosteller or day scholar", "residency", "student type"],
  hostelBlockAndRoomNumber: ["hostelblockandroomnumber", "hostel block and room number", "hostel room", "hostel block", "room number"],
  personalEmail: ["personalmailid", "personal mail id", "personal email", "email"]
};

function keyify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function buildHeaderLookup(row) {
  const lookup = {};
  Object.keys(row).forEach((header) => {
    lookup[keyify(header)] = header;
  });
  return lookup;
}

function pick(row, lookup, field) {
  const aliases = columnMap[field] || [];
  const found = aliases.map(keyify).find((alias) => lookup[alias]);
  return found ? row[lookup[found]] : "";
}

function cleanString(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeGender(value) {
  const text = cleanString(value).toLowerCase();
  if (["m", "male", "boy"].includes(text)) return "Male";
  if (["f", "female", "girl"].includes(text)) return "Female";
  return text ? "Other" : "";
}

function normalizeResidency(value) {
  const text = cleanString(value).toLowerCase();
  if (text.includes("hostel")) return "Hosteller";
  if (text.includes("day")) return "Day Scholar";
  return "";
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const normalized = cleanString(value).replace(/\./g, "/");
  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
  return new Date(Date.UTC(Number(year), Number(mm) - 1, Number(dd)));
}

function normalizeStudentRow(row) {
  const lookup = buildHeaderLookup(row);
  const student = {};
  Object.keys(columnMap).forEach((field) => {
    student[field] = pick(row, lookup, field);
  });

  student.serialNo = Number(cleanString(student.serialNo)) || undefined;
  student.registerNumber = cleanString(student.registerNumber).toUpperCase();
  student.firstName = cleanString(student.firstName);
  student.lastName = cleanString(student.lastName);
  student.gender = normalizeGender(student.gender);
  student.dateOfBirth = parseDate(student.dateOfBirth);
  student.residencyType = normalizeResidency(student.residencyType);

  [
    "caste",
    "officialEmail",
    "phoneNumber",
    "bloodGroup",
    "aadharNumber",
    "panNumber",
    "permanentAddress",
    "presentAddress",
    "stateName",
    "fatherName",
    "fatherContactNumber",
    "motherName",
    "motherContactNumber",
    "hostelBlockAndRoomNumber",
    "personalEmail"
  ].forEach((field) => {
    student[field] = cleanString(student[field]);
  });

  if (!student.firstName && student.registerNumber) {
    student.firstName = student.registerNumber;
  }

  return student;
}

export default function UploadExcel() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  async function upload(event) {
    event.preventDefault();
    if (!file) return toast.error("Choose an Excel file first");

    setProgress(10);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        setProgress(30);

        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

        setProgress(50);

        const seen = new Set();
        const parsed = [];
        const invalidRows = [];

        rows.forEach((row, index) => {
          const student = normalizeStudentRow(row);
          if (!student.registerNumber || !student.firstName) {
            invalidRows.push({ row: index + 2, reason: "Missing register number or name" });
            return;
          }
          if (seen.has(student.registerNumber)) {
            invalidRows.push({ row: index + 2, reason: `Duplicate in file: ${student.registerNumber}` });
            return;
          }
          seen.add(student.registerNumber);
          parsed.push(student);
        });

        if (parsed.length === 0) {
          setProgress(100);
          setResult({
            totalRows: rows.length,
            inserted: 0,
            duplicates: [],
            invalidRows
          });
          toast.error("No valid student rows found");
          return;
        }

        setProgress(70);

        // Check for existing records in Supabase
        const regNumbers = parsed.map((student) => student.registerNumber);
        const { data: existing, error: fetchError } = await supabase
          .from("students")
          .select("reg_no")
          .in("reg_no", regNumbers);

        if (fetchError) {
          throw new Error("Unable to check existing student database records");
        }

        const existingSet = new Set(existing.map((student) => student.reg_no));
        const newStudents = parsed.filter((student) => !existingSet.has(student.registerNumber));
        const duplicates = parsed.filter((student) => existingSet.has(student.registerNumber)).map((student) => student.registerNumber);

        let insertedCount = 0;
        if (newStudents.length > 0) {
          const dbRows = newStudents.map(mapStudentToSupabase);
          const { error: insertError } = await supabase
            .from("students")
            .insert(dbRows);

          if (insertError) {
            throw new Error(insertError.message);
          }
          insertedCount = newStudents.length;
        }

        setProgress(100);
        setResult({
          totalRows: rows.length,
          inserted: insertedCount,
          duplicates,
          invalidRows
        });
        toast.success(`Excel processed: ${insertedCount} students imported.`);
      } catch (error) {
        setProgress(0);
        toast.error(error.message || "Upload and parsing failed");
      }
    };

    reader.onerror = () => {
      setProgress(0);
      toast.error("Error reading file");
    };

    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <div>
        <p className="text-sm font-bold uppercase text-brand-600">Excel Import</p>
        <h1 className="text-3xl font-extrabold">Upload Student Data</h1>
      </div>
      <form onSubmit={upload} className="panel p-6">
        <label className="flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-5 text-center transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900">
          <FileSpreadsheet className="h-12 w-12 text-brand-600" />
          <span className="mt-4 text-lg font-extrabold">{file ? file.name : "Choose CSE C Data Sheet.xlsx"}</span>
          <span className="mt-2 text-sm text-slate-500">Excel columns are detected dynamically and duplicate register numbers are prevented.</span>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => setFile(event.target.files?.[0])} />
        </label>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <button type="submit" className="btn-primary mt-5">
          <UploadCloud className="h-4 w-4" />
          Upload Excel
        </button>
      </form>
      {result && (
        <section className="panel p-5">
          <h2 className="font-extrabold">Upload Result</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-900"><p className="text-xs font-bold uppercase text-slate-500">Rows</p><p className="text-2xl font-extrabold">{result.totalRows}</p></div>
            <div className="rounded-lg bg-emerald-50 p-4 text-emerald-700 dark:bg-emerald-950/30"><p className="text-xs font-bold uppercase">Inserted</p><p className="text-2xl font-extrabold">{result.inserted}</p></div>
            <div className="rounded-lg bg-amber-50 p-4 text-amber-700 dark:bg-amber-950/30"><p className="text-xs font-bold uppercase">Duplicates</p><p className="text-2xl font-extrabold">{result.duplicates.length}</p></div>
            <div className="rounded-lg bg-rose-50 p-4 text-rose-700 dark:bg-rose-950/30"><p className="text-xs font-bold uppercase">Invalid</p><p className="text-2xl font-extrabold">{result.invalidRows.length}</p></div>
          </div>
        </section>
      )}
    </div>
  );
}

