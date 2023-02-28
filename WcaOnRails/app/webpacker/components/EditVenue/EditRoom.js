import React from 'react';
import { Icon } from 'semantic-ui-react';

/**
 * @param {{ name: string, colour: string }} roomWcif
 * @param {() => void} removeRoomAction
 * @param {(wcif: { name: string, colour: string }) => void} updateWcif
 * @returns {JSX.Element}
 * @constructor
 */
export default function EditRoom({ roomWcif, removeRoomAction, updateWcif }) {
  /**
   * @param {Event} e
   */
  function handleNameChange(e) {
    updateWcif({
      ...roomWcif,
      name: e.target.value,
    });
  }

  /**
   * @param {Event} e
   */
  function handleColorChange(e) {
    updateWcif({
      ...roomWcif,
      color: e.target.value,
    });
  }

  return (
    <div className="row room-row">
      <div className="col-xs-9">
        <input
          type="text"
          className="room-name-input form-control"
          defaultValue={roomWcif.name}
          onBlur={handleNameChange}
        />
      </div>
      <div className="col-xs-3">
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a href="#" onClick={removeRoomAction} className="btn btn-danger pull-right">
          <Icon name="trash" />
        </a>
      </div>
      <div className="col-xs-9 room-color-cell">
        <input
          type="color"
          className="form-control"
          defaultValue={roomWcif.color}
          onBlur={handleColorChange}
        />
      </div>
    </div>
  );
}
