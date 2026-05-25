import { Link } from 'react-router-dom'

/**
 * Breadcrumb
 * items: Array of { label: string, to?: string }
 * Last item is always the current page (no link).
 */
export default function Breadcrumb({ items = [] }) {
  if (items.length <= 1) return null

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={index}>
              {!isLast && item.to ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast && <span className="breadcrumb-sep" aria-hidden="true">›</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
