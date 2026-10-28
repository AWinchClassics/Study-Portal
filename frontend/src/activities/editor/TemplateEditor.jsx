import { useRef, useMemo } from 'react'
import { parseTemplate } from '../template'

const EXAMPLES = {
  cloze: 'The [[boule|council of 500]] prepared business for the [[ekklesia|assembly]].',
  dropdown: 'The [[Pericles*|Cleon|Alcibiades]] delivered the funeral oration in [[431 BCE*|404 BCE|399 BCE]].',
}

/** Blank draft for a new cloze / dropdown task. */
export function newTemplateDraft(type) {
  return {
    type, prompt: '', explanation: '', points: 1,
    config: type === 'cloze'
      ? { template: '', typo: true, caseSensitive: false }
      : { template: '' },
  }
}

/** Returns an array of problems (empty = valid). */
export function validateTemplateDraft(d) {
  return parseTemplate(d.config?.template, d.type).errors
}

/**
 * Editor for cloze / dropdown tasks.
 * Teachers write one sentence and wrap each blank in [[ ]].
 *   cloze:    [[answer|other accepted answer]]
 *   dropdown: [[correct*|wrong|wrong]]
 */
export default function TemplateEditor({ draft, onChange, errors }) {
  const ref = useRef(null)
  const isDropdown = draft.type === 'dropdown'
  const cfg = draft.config ?? { template: '' }
  const parsed = useMemo(() => parseTemplate(cfg.template, draft.type), [cfg.template, draft.type])

  function setCfg(patch) { onChange({ ...draft, config: { ...cfg, ...patch } }) }

  // Wrap the highlighted text in [[ ]] (dropdown: [[text*|]] ready for distractors)
  function makeBlank() {
    const el = ref.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const text = cfg.template
    const raw = text.slice(s, e)
    const sel = raw.trim()
    if (!sel) return
    // keep any selected leading/trailing spaces OUTSIDE the brackets (double-click often selects them)
    const lead = raw.slice(0, raw.indexOf(sel))
    const trail = raw.slice(raw.indexOf(sel) + sel.length)
    const wrapped = isDropdown ? `[[${sel}*|]]` : `[[${sel}]]`
    setCfg({ template: text.slice(0, s) + lead + wrapped + trail + text.slice(e) })
  }

  return (
    <>
      <input
        className="t-input"
        placeholder="Instruction (optional), e.g. Complete the sentence."
        value={draft.prompt}
        onChange={e => onChange({ ...draft, prompt: e.target.value })}
      />

      <textarea
        ref={ref}
        className="t-input act-textarea"
        placeholder={EXAMPLES[draft.type]}
        value={cfg.template}
        onChange={e => setCfg({ template: e.target.value })}
      />

      <div className="act-template-help">
        <button type="button" className="t-btn t-btn-ghost" onClick={makeBlank}
          title="Highlight a word in the box above, then click">
          Turn highlighted text into a blank
        </button>
        <span>
          {isDropdown
            ? <>Write blanks as <code>[[correct*|wrong|wrong]]</code> — the <code>*</code> marks the right option.</>
            : <>Write blanks as <code>[[answer]]</code>. Add accepted alternatives with <code>|</code>, e.g. <code>[[413|413 BCE]]</code>.</>}
        </span>
      </div>

      {!isDropdown && (
        <div className="act-template-opts">
          <label className="act-opt-correct">
            <input type="checkbox" checked={cfg.typo !== false} onChange={e => setCfg({ typo: e.target.checked })} />
            Allow one typing slip (answers of 5+ letters)
          </label>
          <label className="act-opt-correct">
            <input type="checkbox" checked={!!cfg.caseSensitive} onChange={e => setCfg({ caseSensitive: e.target.checked })} />
            Match capitals exactly
          </label>
        </div>
      )}

      {parsed.blanks.length > 0 && (
        <div className="act-template-preview">
          <span className="act-preview-label">Preview</span>
          <div className="act-template">
            {parsed.parts.map((p, k) =>
              p.type === 'text'
                ? <span key={k}>{p.value}</span>
                : <span key={k} className="act-chip">
                    {isDropdown
                      ? p.options.map((o, j) => (
                          <span key={j} className={o === p.correct ? 'act-chip-correct' : ''}>{o}{j < p.options.length - 1 ? ' | ' : ''}</span>
                        ))
                      : p.answers.join(' / ')}
                  </span>
            )}
          </div>
        </div>
      )}

      <textarea
        className="t-input act-textarea"
        placeholder="Explanation shown after answering (optional)…"
        value={draft.explanation ?? ''}
        onChange={e => onChange({ ...draft, explanation: e.target.value })}
      />

      {errors?.length > 0 && (
        <ul className="act-errors">{errors.map(e => <li key={e}>{e}</li>)}</ul>
      )}
    </>
  )
}
