import React, {
  useCallback,
  useEffect,
  useMemo, useRef, useState,
} from 'react';
import {
  Button, Card, Form, Icon,
} from 'semantic-ui-react';
import '../../stylesheets/semantic/components/card.min.css';
import '../../stylesheets/semantic/components/button.min.css';
import '../../stylesheets/semantic/components/input.min.css';
import '../../stylesheets/semantic/components/form.min.css';
import '../../stylesheets/semantic/components/form.min';
import { GeoSearchControl } from 'leaflet-geosearch';
import {
  TileLayer, Marker, MapContainer, useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import _ from 'lodash';
import { searchProvider, userTileProvider } from '../../lib/leaflet-wca/providers';
import '../../stylesheets/edit_venues.scss';
import { timezoneData, countries, defaultRoomColor } from '../../lib/wca-data.js.erb';

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
 *  id: *,
 *  name: string,
 *  latitudeMicrodegrees: number,
 *  longitudeMicrodegrees: number,
 *  countryIso2: string,
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
 * @src https://www.npmjs.com/package/leaflet-geosearch
 * @param {{ provider: * } & *} props
 * @returns {null}
 * @constructor
 */
function MapSearch(props) {
  const { marker } = props;
  const map = useMap();
  const searchControl = new GeoSearchControl(props);

  useEffect(() => {
    map.addControl(searchControl);
    map.on('geosearch/showlocation', ({ location }) => {
      console.log(location);
      map.flyTo([location.y, location.x], DEFAULT_ZOOM);
      marker.bindPopup(location.label).openPopup();
    });
    return () => map.removeControl(searchControl);
  }, [props]);

  return null;
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
        <Card key={venue.id} className="edit-venue">
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
 * @param {() => void} removeVenue
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
    const areChanges = venue.latitudeMicrodegrees !== newLat
      || venue.longitudeMicrodegrees !== newLng;
    if (areChanges) {
      updateVenue({
        ..._.cloneDeep(venue),
        latitudeMicrodegrees: newLat,
        longitudeMicrodegrees: newLng,
      });
    }
  }

  const handleNameChange = useCallback((e) => {
    updateVenue({
      ...venue,
      name: e.target.value,
    });
  }, [venue]);
  const handleLocationChange = useCallback(handlePositionChange, [venue]);
  const handleCountryChange = useCallback((e, { value }) => {
    updateVenue({
      ...venue,
      countryIso2: value,
    });
  }, [venue]);
  const handleTimezoneChange = useCallback((e, { value }) => {
    console.log(value);
    updateVenue({
      ...venue,
      timezone: value,
    });
  }, [venue]);

  // Instead of giving *all* TZInfo, use uniq-fied rails "meaningful" subset
  // We'll add the "country_zones" to that, because some of our competitions
  // use TZs not included in this subset.
  // We want to display the "country_zones" first, so that it's more convenient for the user.
  // In the end the array should look like that:
  //   - country_zone_a, country_zone_b, [...], other_tz_a, other_tz_b, [...]
  const competitionZonesKeys = Object.keys(competitionInfo.countryZones);
  let selectKeys = _.difference(Object.keys(timezoneData), competitionZonesKeys);
  selectKeys = _.union(competitionZonesKeys.sort(), selectKeys.sort());

  return (
    <>
      <Card.Header>
        Editing Venue
        {' "'}
        {venue.name}
        &quot;
        <Button icon="trash" onClick={removeVenue} />
      </Card.Header>
      <Form>

        <Form.Input
          type="text"
          label="Name"
          value={venue.name}
          onChange={handleNameChange}
        />

        <Form.Field label="Please pick the venue location below by dragging the marker">
          <MapContainer
            center={mapPosition}
            zoom={DEFAULT_ZOOM}
          >
            <MapSearch
              provider={searchProvider}
              showMarker={false}
              showPopup={false}
              retainZoomLevel
              autoClose
                // eslint-disable-next-line react/style-prop-object
              style="bar"
              autoComplete
              autoCompleteDelay={250}
              searchLabel="Enter an address"
            />
            <TileLayer url={userTileProvider.url} attribution={userTileProvider.attribution} />
            <DraggableMarker
              initialPosition={mapPosition}
              onChange={handleLocationChange}
            />
          </MapContainer>
        </Form.Field>

        <Form.Select
          options={countries.real.map(({ iso2, name }) => ({
            text: name,
            value: iso2,
            key: iso2,
          }))}
          label="Country"
          value={venue.countryIso2}
          onChange={handleCountryChange}
        />

        <Form.Select
          options={[
            { text: 'Please select a timezone', value: '', key: '' },
            ...selectKeys.map((key) => ({
              text: key,
              value: timezoneData[key],
              key,
            })),
          ]}
          label="Timezone"
          value={venue.timezone || 'Please select a timezone'}
          onChange={handleTimezoneChange}
        />

      </Form>
    </>
  );
}
