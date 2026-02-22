import { type ReactNode, useEffect, useMemo, useState } from "react";
import { fetchDoctors, type Doctor } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Card, Pill } from "../ui/components";

const tierOrder = ["A", "B", "C"];

function getWhatsappNumber(doctor: Doctor) {
  const value =
    doctor.whatsappNumber ??
    doctor.whatsapp_number ??
    doctor.phoneNumber ??
    doctor.phone ??
    doctor.mobile ??
    null;
  return value?.trim() || null;
}

function getEmailAddress(doctor: Doctor) {
  const value = doctor.email ?? doctor.emailAddress ?? doctor.email_address ?? null;
  return value?.trim() || null;
}

function toWhatsappUrl(number: string) {
  const digits = number.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function toGmailComposeUrl(email: string) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
}

function toMailtoUrl(email: string) {
  return `mailto:${encodeURIComponent(email)}`;
}

function ContactLink({
  href,
  label,
  value,
  title,
  icon,
}: {
  href: string | null;
  label: string;
  value?: string | null;
  title: string;
  icon: ReactNode;
}) {
  if (!href) {
    return (
      <span className="pn-contact-link disabled" title={`${label} not available`}>
        {icon}
        <span>{value || label}</span>
      </span>
    );
  }

  return (
    <a className="pn-contact-link" href={href} target="_blank" rel="noreferrer" title={title}>
      {icon}
      <span>{value || label}</span>
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.05 4.94A9.9 9.9 0 0 0 12 2a10 10 0 0 0-8.68 14.97L2 22l5.16-1.35A10 10 0 1 0 19.05 4.94ZM12 20.13a8.07 8.07 0 0 1-4.12-1.13l-.29-.18-3.06.8.82-2.98-.19-.31A8.13 8.13 0 1 1 12 20.13Zm4.46-6.05c-.24-.12-1.41-.7-1.63-.78-.22-.08-.38-.12-.55.12-.16.24-.63.78-.77.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.17-.7-.63-1.18-1.41-1.32-1.65-.14-.24-.01-.37.1-.49.11-.11.24-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.76-1.81-.2-.47-.4-.4-.55-.41h-.47c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.39 1.38.5.58.18 1.11.15 1.53.09.47-.07 1.41-.58 1.61-1.15.2-.57.2-1.05.14-1.15-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm16 2H4v.2l8 5.33 8-5.33V7Zm0 10V9.6l-7.45 4.96a1 1 0 0 1-1.1 0L4 9.6V17h16Z"
      />
    </svg>
  );
}

export default function DoctorDirectoryPage() {
  const { token } = useAuth();
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchDoctors(token, { size: 200 })
      .then((result) => setAllDoctors(result.content))
      .catch(() => setAllDoctors([]));
  }, [token]);

  const doctors = useMemo(() => {
    let filtered = allDoctors;
    if (tierFilter) filtered = filtered.filter((doctor) => doctor.tier === tierFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((doctor) =>
        doctor.fullName.toLowerCase().includes(q) || (doctor.specialty || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allDoctors, search, tierFilter]);

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Doctor Directory</h1>
          <p>{doctors.length} physicians across all territories</p>
        </div>
      </div>

      <div className="pn-directory-filters">
        <input
          placeholder="Search doctors by name or specialty..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="chips">
          <button className={`pn-chip-btn ${tierFilter === "" ? "active" : ""}`} onClick={() => setTierFilter("")}>All</button>
          {tierOrder.map((tier) => (
            <button key={tier} className={`pn-chip-btn ${tierFilter === tier ? "active" : ""}`} onClick={() => setTierFilter(tier)}>
              Tier {tier}
            </button>
          ))}
        </div>
      </div>

      <Card className="pn-table-card">
        <table className="pn-table">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Specialty</th>
              <th>Tier</th>
              <th>Territory</th>
              <th>Priority</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((doctor) => {
              const whatsappNumber = getWhatsappNumber(doctor);
              const emailAddress = getEmailAddress(doctor);

              return (
                <tr key={doctor.id}>
                  <td>
                    <strong>{doctor.fullName}</strong>
                    <div className="muted">{doctor.notes || "No additional address data"}</div>
                  </td>
                  <td>{doctor.specialty || "General Practitioner"}</td>
                  <td><Pill>{doctor.tier}</Pill></td>
                  <td>{doctor.territoryId ? "Assigned" : "Unassigned"}</td>
                  <td>{doctor.priorityScore}</td>
                  <td>
                    <div className="pn-contact-links">
                      <ContactLink
                        href={whatsappNumber ? toWhatsappUrl(whatsappNumber) : null}
                        label="WhatsApp"
                        value={whatsappNumber}
                        title="Open WhatsApp chat"
                        icon={<WhatsAppIcon />}
                      />
                      <div className="pn-contact-email-group">
                        <ContactLink
                          href={emailAddress ? toGmailComposeUrl(emailAddress) : null}
                          label="Email"
                          value={emailAddress}
                          title="Open Gmail compose"
                          icon={<MailIcon />}
                        />
                        {emailAddress ? (
                          <a className="pn-contact-secondary" href={toMailtoUrl(emailAddress)} title="Open default mail app">
                            Open mail app
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
