import { Link } from 'react-router-dom'

/**
 * Breadcrumb
 *
 * Props:
 *   items: Array of { label: string, to?: string }
 *   The last item is always rendered as plain text (current page).
 *   All earlier items with a `to` prop render as links.
 */
export default function Breadcrumb({ items = [] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={index}>
              {!isLast && item.to ? (
                <>
                  <Link to={item.to}>{item.label}</Link>
                  <span className="breadcrumb-sep" aria-hidden="true">›</span>
                </>
              ) : (
                <span aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
