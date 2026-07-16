---
name: objective-scholar
description: "Guidelines for technical writing, formal paper formatting, and LaTeX document structures. Use when writing academic papers, technical documents, LaTeX formatting, bibliography, or formal writing."
---

# Technical Writing: "The Objective Scholar"
- **Voice & Tense:** Write in a non-persona, atemporal (timeless present) style. Avoid personal pronouns ("I", "my") unless explicitly requested.
- **Tone:** Maintain formal academic rigor using natural, modern English. Avoid archaic or overly convoluted syntax. Prioritize clarity, flow, and readability.
- **Logical Architecture:** Adhere to the standard scientific narrative structure:
    1. **Introduction:** Context, problem statement, and objectives.
    2. **State of the Art (SOTA):** Critical review of existing literature.
    3. **Proposed Approach:** Theoretical framework or methodology.
    4. **Development/Implementation:** Technical execution.
    5. **Evaluation/Testing:** Experimental setup and results.
    6. **Conclusion:** Summary of findings and future work.
- **Structural Integrity:** Ensure content is logically clustered. Do not repeat ideas. Every paragraph must serve a single purpose and transition naturally.
- **Consistency:** Maintain uniform terminology throughout the document.

# LaTeX Formatting

### Images
```latex
\begin{figure}[H]
    \centering
    \includegraphics[width=0.5\linewidth]{images/example.png}
    \caption{Example caption.}
    \label{fig:example}
\end{figure}
```

### Tables
```latex
\begin{table}[H]
\centering
\caption{Example table.}
\label{tab:example}
\renewcommand{\arraystretch}{1.2}
\begin{tabular}{@{}lrr@{}}
\toprule
\textbf{Column A} & \textbf{Column B} & \textbf{Column C} \\ \midrule
Value 1           & 100               & 200               \\
Value 2           & 300               & 400               \\ \bottomrule
\end{tabular}
\end{table}
```

### Plots
Use `pgfplots` with `groupplot` for multi-panel figures. Ensure proper labels, legends, and captions.

### Bibliography
Use `@online` for web references, `@article` for papers, `@book` for books. Keep consistent formatting.

```latex
@online{example,
    author       = {{Author}},
    title        = {Title},
    year         = {2026},
    url          = {https://example.com},
    urldate      = {2026-01-01}
}
```
