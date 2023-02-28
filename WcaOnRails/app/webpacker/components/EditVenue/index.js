import React from 'react';
import _ from 'lodash';
import {
  Button, Panel, Row, Col,
} from 'react-bootstrap';
import { Icon } from 'semantic-ui-react';
import { timezoneData, countries, defaultRoomColor } from '../../lib/wca-data.js.erb';
import EditRoom from './EditRoom';
import {
  convertVenueActivitiesToVenueTimezone,
  toMicrodegrees,
} from '../../lib/utils/edit-schedule';
import VenueLocationInput from './VenueLocationInput';

/**
 * @param {{ venueDetails: * }} competitionInfo
 * @param {string} id
 * @returns {{ color: string, activities: *[], name: string, id: string }}
 */
function newRoom(competitionInfo, id) {
  return {
    id,
    // Venue details is an optional (nullable) field
    name: competitionInfo.venueDetails || "Room's name",
    color: defaultRoomColor,
    activities: [],
  };
}

export default function EditVenue({
  venueWcif,
  removeVenueAction,
  competitionInfo,
  updateWcif,
}) {
  const handleTimezoneChange = (e) => {
    const newVenueWcif = {
      ..._.cloneDeep(venueWcif),
      timezone: e.target.value,
    };
    convertVenueActivitiesToVenueTimezone(venueWcif.timezone, newVenueWcif);
    updateWcif(newVenueWcif);
  };

  const handleNameChange = (e) => {
    updateWcif({
      ...venueWcif,
      name: e.target.value,
    });
  };

  const handleCountryChange = (e) => {
    updateWcif({
      ...venueWcif,
      countryIso2: e.target.value,
    });
  };

  const handlePositionChange = (event) => {
    // eslint-disable-next-line no-underscore-dangle
    const pos = event.target._latlng;
    const newLat = toMicrodegrees(pos.lat);
    const newLng = toMicrodegrees(pos.lng);
    if (
      venueWcif.latitudeMicrodegrees !== newLat
      || venueWcif.longitudeMicrodegrees !== newLng
    ) {
      updateWcif({
        ..._.cloneDeep(venueWcif),
        latitudeMicrodegrees: newLat,
        longitudeMicrodegrees: newLng,
      });
    }
  };

  // Instead of giving *all* TZInfo, use uniq-fied rails "meaningful" subset
  // We'll add the "country_zones" to that, because some of our competitions
  // use TZs not included in this subset.
  // We want to display the "country_zones" first, so that it's more convenient for the user.
  // In the end the array should look like that:
  //   - country_zone_a, country_zone_b, [...], other_tz_a, other_tz_b, [...]
  const competitionZonesKeys = Object.keys(competitionInfo.countryZones);
  let selectKeys = _.difference(Object.keys(timezoneData), competitionZonesKeys);
  selectKeys = _.union(competitionZonesKeys.sort(), selectKeys.sort());

  function newRoomId() {
    return (_.max(_.map(venueWcif.rooms, 'id')) || 0) + 1;
  }

  const actionsHandlers = {
    addRoom: (e) => {
      e.preventDefault();
      updateWcif({
        ...venueWcif,
        rooms: [
          ...venueWcif.rooms,
          newRoom(competitionInfo, newRoomId()),
        ],
      });
    },
    removeRoom: (e, index) => {
      e.preventDefault();
      if (!confirm(
        `Are you sure you want to remove the room "${venueWcif.rooms[index].name}" and the associated schedule?`,
      )) return;

      updateWcif({
        ...venueWcif,
        rooms: [
          ...venueWcif.rooms.slice(0, index),
          ...venueWcif.rooms.slice(index + 1),
        ],
      });
    },
    updateWcif,
  };
  return (
    <div>
      <div className="panel-venue">
        <Panel>
          <Panel.Heading>
            <Row>
              <Col xs={9} className="venue-title">
                Editing venue &quot;
                {venueWcif.name}
                &quot;
              </Col>
              <Col xs={3}>
                <Button onClick={removeVenueAction} bsStyle="danger" className="pull-right">
                  <Icon name="trash" />
                </Button>
              </Col>
            </Row>
          </Panel.Heading>
          <Panel.Body>
            <NameInput name={venueWcif.name} actionHandler={handleNameChange} />
            <VenueLocationInput
              lat={venueWcif.latitudeMicrodegrees}
              lng={venueWcif.longitudeMicrodegrees}
              actionHandler={handlePositionChange}
            />
            <CountryInput value={venueWcif.countryIso2} onChange={handleCountryChange} />
            <TimezoneInput
              timezone={venueWcif.timezone}
              selectKeys={selectKeys}
              actionHandler={handleTimezoneChange}
            />
            <RoomsList venueWcif={venueWcif} actionsHandlers={actionsHandlers} />
          </Panel.Body>
        </Panel>
      </div>
    </div>
  );
}

function NameInput({ name, actionHandler }) {
  return (
    <Row>
      <Col xs={3}>
        <span className="venue-form-label control-label">Name:</span>
      </Col>
      <Col xs={9}>
        <input type="text" className="venue-name-input form-control" value={name} onChange={(e) => actionHandler(e, 'name')} />
      </Col>
    </Row>
  );
}

function CountryInput({ value, onChange }) {
  return (
    <Row>
      <Col xs={3}>
        <span className="venue-form-label control-label">Country:</span>
      </Col>
      <Col xs={9}>
        <select
          className="form-control"
          value={value}
          onChange={onChange}
        >
          {countries.real.map((country) => (
            <option key={country.iso2} value={country.iso2}>
              {country.name}
            </option>
          ))}
        </select>
      </Col>
    </Row>
  );
}

function TimezoneInput({ timezone, selectKeys, actionHandler }) {
  return (
    <Row>
      <Col xs={3}>
        <span className="venue-form-label control-label">Timezone:</span>
      </Col>
      <Col xs={9}>
        <select
          className="venue-timezone-input form-control"
          value={timezone}
          onChange={(e) => actionHandler(e, 'timezone')}
        >
          {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
          <option value="" />
          {selectKeys.map((key) => (
            <option key={key} value={timezoneData[key] || key}>{key}</option>
          ))}
        </select>
      </Col>
    </Row>
  );
}

function RoomsList({ venueWcif, actionsHandlers }) {
  return (
    <Row>
      <Col xs={3}>
        <span className="venue-form-label control-label">Rooms:</span>
      </Col>
      <Col xs={9}>
        {venueWcif.rooms
          .sort((a, b) => a.id - b.id)
          .map((roomWcif, index) => (
            <EditRoom
              roomWcif={roomWcif}
              key={roomWcif.id}
              removeRoomAction={(e) => actionsHandlers.removeRoom(e, index)}
              updateWcif={(wcif) => actionsHandlers.updateWcif({
                ...venueWcif,
                rooms: [
                  ...venueWcif.rooms.filter((v) => v.id !== roomWcif.id),
                  wcif,
                // sort so that on changes, the order of the rooms is preserved
                ].sort((a, b) => a.id - b.id),
              })}
            />
          ))}
        <NewRoom newRoomAction={actionsHandlers.addRoom} />
      </Col>
    </Row>
  );
}

function NewRoom({ newRoomAction }) {
  return (
    <Row>
      <Col xs={12}>
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a href="#" className="btn btn-success new-room-link" onClick={newRoomAction}>Add room</a>
      </Col>
    </Row>
  );
}
