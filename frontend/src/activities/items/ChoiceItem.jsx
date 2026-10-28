/**
 * Player UI for single / multi / tf tasks.
 * Reuses the existing .qr-option styles so it looks like current quizzes.
 *
 * Props:
 *   item         - activity_items row with mc_options
 *   optionOrder  - array of option ids in display order
 *   selected     - array of selected option ids
 *   checked      - true once the answer has been checked (locks + shows result)
 *   onChange     - function(newSelectedIds)
 */
export default function ChoiceItem({ item, optionOrder, selected, checked, onChange }) {
  const byId = Object.fromEntries(item.mc_options.map(o => [o.id, o]))
  const isMulti = item.type === 'multi'

  function toggle(id) {
    if (checked) return
    if (isMulti) {
      onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
    } else {
      onChange([id])
    }
  }

  return (
    <div className="qr-options" role={isMulti ? 'group' : 'radiogroup'}>
      {isMulti && !checked && <p className="act-hint">Select all that apply.</p>}
      {optionOrder.map((id, i) => {
        const opt = byId[id]
        if (!opt) return null
        const isSel = selected.includes(id)
        let cls = 'qr-option'
        let icon = null
        if (checked) {
          if (opt.is_correct) { cls += ' qr-option-correct'; icon = '✓' }
          else if (isSel)     { cls += ' qr-option-incorrect'; icon = '✗' }
        } else if (isSel) {
          cls += ' qr-option-selected'
        }
        return (
          <button
            key={id}
            type="button"
            className={cls}
            onClick={() => toggle(id)}
            disabled={checked}
            role={isMulti ? 'checkbox' : 'radio'}
            aria-checked={isSel}
          >
            <span className={`qr-option-letter ${isMulti ? 'act-letter-box' : ''}`}>
              {isMulti ? (isSel ? '✓' : '') : String.fromCharCode(65 + i)}
            </span>
            <span className="qr-option-text">{opt.option_text}</span>
            {icon && <span className="qr-option-icon">{icon}</span>}
          </button>
        )
      })}
    </div>
  )
}
