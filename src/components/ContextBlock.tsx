import type { ExamContext, LanguageMode } from "../types/exam";
import { MathText, pickText } from "./MathText";

export function ContextBlock({
  context,
  mode,
}: {
  context: ExamContext;
  mode: LanguageMode;
}) {
  const langs: Array<"en" | "hi"> = mode === "bilingual" ? ["hi", "en"] : [mode];
  return (
    <section className="context" aria-label="Question context">
      {langs.map((lang) => {
        const directions = pickText(context.directions, lang);
        const title = pickText(context.title ?? undefined, lang);
        const passage = pickText(context.passage ?? undefined, lang);
        return (
          <div key={lang} className="lang-block">
            {mode === "bilingual" ? <div className="lang-label">{lang === "hi" ? "हिन्दी" : "English"}</div> : null}
            {directions ? <p><MathText text={directions} /></p> : null}
            {title ? <h3>{title}</h3> : null}
            {passage ? <p className="q-text"><MathText text={passage} /></p> : null}
          </div>
        );
      })}
      {context.table ? <ExamTableView table={context.table} mode={mode} /> : null}
      {context.chart ? <ExamChartView chart={context.chart} mode={mode} type={context.type} /> : null}
    </section>
  );
}

function ExamTableView({
  table,
  mode,
}: {
  table: NonNullable<ExamContext["table"]>;
  mode: LanguageMode;
}) {
  const lang = mode === "en" ? "en" : "hi";
  return (
    <div className="chart">
      <table className="data-table">
        <thead>
          <tr>
            <th>{pickText(table.rowHeader, lang) || (mode === "hi" ? "मद" : "Item")}</th>
            {table.columns.map((column, index) => (
              <th key={index}>{pickText(column, lang)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              <td>{pickText(typeof row.label === "string" ? { en: row.label, hi: row.label } : row.label, lang)}</td>
              {row.values.map((value, valueIndex) => (
                <td key={valueIndex}>{String(value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExamChartView({
  chart,
  mode,
  type,
}: {
  chart: NonNullable<ExamContext["chart"]>;
  mode: LanguageMode;
  type: string;
}) {
  const lang = mode === "en" ? "en" : "hi";
  const max = Math.max(...chart.series.flatMap((series) => series.values), 1);
  return (
    <div className="chart" role="img" aria-label={type === "line_chart" ? "Line chart data" : "Bar chart data"}>
      {chart.series.map((series) => (
        <div key={pickText(series.name, lang)} className="bars" style={{ marginBottom: 12 }}>
          <strong>{pickText(series.name, lang)}{chart.unit ? ` (${chart.unit})` : ""}</strong>
          {chart.categories.map((category, index) => {
            const value = series.values[index] ?? 0;
            return (
              <div className="bar-row" key={`${category}-${index}`}>
                <span>{category}</span>
                <div className="bar" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
                <span>{value}</span>
              </div>
            );
          })}
        </div>
      ))}
      {chart.note ? <p className="muted">{chart.note}</p> : null}
    </div>
  );
}
