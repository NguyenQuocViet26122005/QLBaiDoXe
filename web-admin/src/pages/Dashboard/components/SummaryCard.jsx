export default function SummaryCard({ icon: Icon, label, value, helper, accent = false }) {
  return <article className={`summary-card ${accent ? 'accent' : ''}`}><div className="summary-icon"><Icon size={22} weight="duotone" /></div><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>;
}
