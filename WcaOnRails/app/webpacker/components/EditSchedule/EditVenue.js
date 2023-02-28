import React, {
  useCallback, useMemo, useRef, useState,
} from 'react';
import { Button, Card, Icon } from 'semantic-ui-react';
import '../../stylesheets/semantic/components/card.min.css';
import '../../stylesheets/semantic/components/button.min.css';
import { TileLayer, Marker, MapContainer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import _ from 'lodash';
import { userTileProvider } from '../../lib/leaflet-wca/providers';
import '../../stylesheets/edit_venues.scss';
import { Drag } from 'leaflet/src/map/handler/Map.Drag.js';

// eslint react/jsx-no-bind: "off"

const DEFAULT_ZOOM = 16;

export function toMicrodegrees(coord) {
  return Math.trunc(parseFloat(coord) * 1e6);
}
export function toDegrees(coord) {
  return coord / 1e6;
}

/**
 * @typedef {{
 *  name: string,
 *  latitudeMicrodegrees: number,
 *  longitudeMicrodegrees: number,
 * }} Venue
 */

/**
 * @param {{ lat: number, lng: number }} initialPosition
 * @param {(coords: { lat: number, lng: number }) => *} onChange
 * @returns {JSX.Element}
 * @constructor
 */
function DraggableMarker({ initialPosition, onChange }) {
  // src: https://react-leaflet.js.org/docs/example-draggable-marker/

  const [position, setPosition] = useState(initialPosition);
  const markerRef = useRef(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const coords = marker.getLatLng();
          setPosition(coords);
          onChange(coords);
        }
      },
    }),
    [],
  );

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
}

/**
 * @param {Venue[]} venues
 * @param {{
 *     addVenue(): void,
 *     removeVenue(venueId: number): void,
 *     updateVenue(venueId: number, newVenue: Venue): void
 * }} actionsHandlers
 * @param {*} competitionInfo
 * @returns {JSX.Element}
 * @constructor
 */
export function VenuesList({
  venues,
  competitionInfo,
  removeVenue,
  updateVenue,
  addVenue,
}) {
  return (
    <div className="edit-venues cards">
      {venues.map((venue) => (
        <Card key={venue.id}>
          <EditVenue
            venue={venue}
            competitionInfo={competitionInfo}
            removeVenue={() => removeVenue(venue.id)}
            updateVenue={(v) => updateVenue(venue.id, v)}
          />
        </Card>
      ))}
      <Card className="unstyled">
        <Button icon onClick={addVenue} labelPosition="right">
          Add a venue
          <Icon name="plus" />
        </Button>
      </Card>
    </div>
  );
}

/**
 * @param {Venue} venue
 * @param {() => Promise<void>} removeVenue
 * @param {{ }} competitionInfo
 * @param {(newVenue: Venue) => void} updateVenue
 * @returns {JSX.Element}
 * @constructor
 */
export default function EditVenue({
  venue,
  removeVenue,
  competitionInfo,
  updateVenue,
}) {
  const mapPosition = {
    lat: toDegrees(venue.latitudeMicrodegrees),
    lng: toDegrees(venue.longitudeMicrodegrees),
  };

  function handlePositionChange({ lat, lng }) {
    const newLat = toMicrodegrees(lat);
    const newLng = toMicrodegrees(lng);
    if (
      venue.latitudeMicrodegrees !== newLat
      || venue.longitudeMicrodegrees !== newLng
    ) {
      updateVenue({
        ..._.cloneDeep(venue),
        latitudeMicrodegrees: newLat,
        longitudeMicrodegrees: newLng,
      });
    }
  }

  return (
    <Card className="edit-venue">
      <Card.Header>
        Editing Venue
        {' "'}
        {venue.name}
        &quot;
        <Button icon="trash" onClick={removeVenue} />
      </Card.Header>
      <Card.Content>
        <MapContainer
          center={mapPosition}
          zoom={DEFAULT_ZOOM}
        >
          <TileLayer url={userTileProvider.url} attribution={userTileProvider.attribution} />
          <DraggableMarker
            initialPosition={mapPosition}
            onChange={handlePositionChange}
          />
        </MapContainer>
      </Card.Content>
    </Card>
  );
}
