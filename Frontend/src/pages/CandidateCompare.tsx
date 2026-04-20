import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jobs as jobsApi, results as resultsApi, applicants as applicantsApi } from "@/api/backend";
import { ArrowLeft } from "lucide-react";
import ScoreBadge from "../components/ScoreBadge";
import ConfidenceBadge from "../components/ConfidenceBadge";

export default function CandidateCompare() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get("job");
  const candidateIds = (urlParams.get("candidates") || "").split(",").filter(Boolean);
  
  const [results, setResults] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [jobs, allResults, allApplicants] = await Promise.all([
        jobsApi.get(jobId).then(j => [j]),
        resultsApi.listByJob(jobId),
        applicantsApi.listByJob(jobId),
      ]);
      setJob(jobs[0]);
      setResults(allResults.filter(r => candidateIds.includes(r.applicant_id)));
      setApplicants(allApplicants.filter(a => candidateIds.includes(a.id)));
      setLoading(false);
    }
    if (jobId && candidateIds.length > 0) load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const dimensions = [
    { key: "match_score", label: "Overall Score" },
    { key: "skills_score", label: "Skills Match" },
    { key: "experience_score", label: "Experience" },
    { key: "education_score", label: "Education" },
    { key: "relevance_score", label: "Role Relevance" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-heading font-bold">Candidate Comparison</h1>
          {job && <p className="text-sm text-muted-foreground">{job.title}</p>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">Criteria</th>
              {results.map(r => (
                <th key={r.id} className="text-center py-3 px-4 border-b border-border">
                  <p className="font-heading font-semibold text-sm">{r.applicant_name}</p>
                  <p className="text-[10px] text-muted-foreground">Rank #{r.rank}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dimensions.map(dim => {
              const maxVal = Math.max(...results.map(r => r[dim.key] || 0));
              return (
                <tr key={dim.key} className="border-b border-border">
                  <td className="py-3 px-4 text-sm font-medium">{dim.label}</td>
                  {results.map(r => {
                    const val = r[dim.key] || 0;
                    const isBest = val === maxVal && maxVal > 0;
                    return (
                      <td key={r.id} className="py-3 px-4 text-center">
                        <div className="flex justify-center">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border ${
                            isBest ? 'bg-accent/10 text-accent border-accent/30' : 'bg-muted text-foreground border-border'
                          }`}>
                            {val}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Confidence */}
            <tr className="border-b border-border">
              <td className="py-3 px-4 text-sm font-medium">Confidence</td>
              {results.map(r => (
                <td key={r.id} className="py-3 px-4 text-center">
                  <div className="flex justify-center">
                    <ConfidenceBadge level={r.confidence_level} />
                  </div>
                </td>
              ))}
            </tr>

            {/* Strengths */}
            <tr className="border-b border-border">
              <td className="py-3 px-4 text-sm font-medium align-top">Key Strengths</td>
              {results.map(r => (
                <td key={r.id} className="py-3 px-4 text-xs text-left align-top">
                  <ul className="space-y-1">
                    {(r.strengths || []).slice(0, 3).map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-accent mt-1.5 shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>

            {/* Gaps */}
            <tr className="border-b border-border">
              <td className="py-3 px-4 text-sm font-medium align-top">Gaps / Risks</td>
              {results.map(r => (
                <td key={r.id} className="py-3 px-4 text-xs text-left align-top">
                  <ul className="space-y-1">
                    {(r.gaps || []).slice(0, 3).map((g, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-destructive mt-1.5 shrink-0" />
                        {/* FIX: gaps are objects {description, type} — was rendering the object directly */}
                        <span>
                          {typeof g === "string" ? g : g?.description || ""}
                          {typeof g === "object" && g?.type && (
                            <span className="ml-1 text-muted-foreground">({g.type})</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>

            {/* Recommendation */}
            <tr>
              <td className="py-3 px-4 text-sm font-medium align-top">Recommendation</td>
              {results.map(r => (
                <td key={r.id} className="py-3 px-4 text-xs text-left align-top text-muted-foreground">
                  {r.recommendation}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}