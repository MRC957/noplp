import React, { useState } from 'react';
import '../../DatabaseEditor.css';

/**
 * A reusable component for adding items (e.g., songs or categories) to a parent entity
 * @param {Object} props - Component props
 * @param {Array} props.items - List of items to display
 * @param {Array} props.selectedIds - List of selected item IDs
 * @param {Function} props.onSelectItem - Callback for selecting/deselecting an item
 * @param {Function} props.onAddSelected - Callback for adding selected items
 * @param {Function} props.onClose - Callback for closing the panel
 * @param {String} props.title - Title of the panel
 * @param {String} props.searchPlaceholder - Placeholder text for the search input
 * @param {String} props.emptyMessage - Message to display when no items are available
 */
const AddPanel = ({
  items = [],
  selectedIds = [],
  onSelectItem,
  onAddSelected,
  onClose,
  title = 'Add Items',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items available',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter items based on the search query
  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(query);
  });

  return (
    <div className="add-panel db-add-panel">
      <div className="db-panel-header">
        <h3>{title}</h3>
        <button className="db-close-button" onClick={onClose}>×</button>
      </div>

      <div className="db-search-bar">
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="db-selection-actions">
        <button
          className="db-add-selected-button"
          onClick={onAddSelected}
          disabled={selectedIds.length === 0}
        >
          Add Selected ({selectedIds.length})
        </button>
      </div>

      <div className="db-available-items">
        {filteredItems.length > 0 ? (
          <ul className="db-selection-list">
            {filteredItems.map(item => (
              <li key={item.id} className="db-selection-item">
                <div className="db-checkbox">
                  <input
                    type="checkbox"
                    id={`item-${item.id}`}
                    checked={selectedIds.includes(item.id)}
                    onChange={() => onSelectItem(item.id)}
                  />
                  <label htmlFor={`item-${item.id}`}>
                    <span className="db-subitem-title">{item.name}</span>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="db-no-items-available">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
};

export default AddPanel;