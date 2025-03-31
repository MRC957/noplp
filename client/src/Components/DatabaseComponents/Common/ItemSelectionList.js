import React from 'react';
import '../../DatabaseEditor.css';

/**
 * A reusable component for selecting items from a list
 * @param {Object} props - Component props
 * @param {Array} props.items - Array of items to display in the list
 * @param {Array} props.selectedIds - Array of selected item IDs
 * @param {Function} props.onSelectItem - Function to call when an item is selected/deselected
 * @param {Function} props.renderItem - Function to render each item (receives item object)
 * @param {String} props.emptyMessage - Message to display when the list is empty
 */
const ItemSelectionList = ({ 
  items = [], 
  selectedIds = [], 
  onSelectItem,
  renderItem,
  emptyMessage = "No items available"
}) => {
  if (items.length === 0) {
    return <p>{emptyMessage}</p>;
  }
  
  return (
    <ul className="selection-list">
      {items.map(item => (
        <li key={item.id} className="selection-item">
          <div className="item-checkbox">
            <input
              type="checkbox"
              id={`sel-item-${item.id}`}
              checked={selectedIds.includes(item.id)}
              onChange={() => onSelectItem(item.id)}
            />
            <label htmlFor={`sel-item-${item.id}`}>
              {renderItem(item)}
            </label>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default ItemSelectionList;