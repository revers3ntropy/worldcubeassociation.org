/* eslint-disable react/jsx-no-bind */
import React, { useState } from 'react';
import _ from 'lodash';
import {
  Message, Container, Button, Tab, Icon,
} from 'semantic-ui-react';
import '../../stylesheets/semantic/components/tab.min.css';
import '../../stylesheets/semantic/components/tab.min';
import '../../stylesheets/semantic/components/message.min.css';
import '../../stylesheets/semantic/components/container.min.css';
import '../../stylesheets/semantic/components/button.min.css';
import '../../stylesheets/semantic/components/icon.min.css';
import '../../stylesheets/semantic/components/card.min.css';
import '../../stylesheets/edit_schedule.scss';
import { parseActivityCode, saveWcif } from '../../lib/utils/wcif';
import { VenuesList } from './EditVenue';
import SchedulesEditor from './ScheduleEditor';

// eslint react/jsx-no-bind: "off"

const LONG_EVENTS = ['333fm', '333mbf', 'other-lunch', 'other-awards'];

export function defaultDurationFromActivityCode(activityCode) {
  const { eventId } = parseActivityCode(activityCode);
  return LONG_EVENTS.includes(eventId) ? 60 : 30;
}

function newVenue(competitionInfo, id) {
  return {
    id,
    name: 'New Venue',
    countryIso2: competitionInfo.countryIso2,
    latitudeMicrodegrees: competitionInfo.lat,
    longitudeMicrodegrees: competitionInfo.lng,
    timezone: '',
    rooms: [],
  };
}

/**
 * @param {() => *} onClick
 * @param {boolean} saving
 * @returns {JSX.Element}
 * @constructor
 */
function UnsavedChangesAlert({ onClick, saving }) {
  return (
    <Message>
      You have unsaved changes. Don&rsquo;t forget to
      {' '}
      <Button
        onClick={onClick}
        disabled={saving}
        icon
        labelPosition="right"
      >
        save your changes
        <Icon name="save" />
      </Button>
    </Message>
  );
}

function IntroductionMessage() {
  return (
    <Container>
      <p>
        Depending on the size and setup of the competition, it may take place in
        several rooms of several venues.
        Therefore a schedule is necessarily linked to a specific room.
        Each room may have its own schedule (with all or a subset of events).
        So you can start creating the competition&rsquo;s schedule below by adding at
        least one venue with one room.
        Then you will be able to select this room in the &quot;Edit schedules&quot;
        panel, and drag and drop event rounds (or attempts for some events) on it.
      </p>
      <p>
        For the typical simple competition, creating one &quot;Main venue&quot;
        with one &quot;Main room&quot; is enough.
        If your competition has a single venue but multiple &quot;stages&quot; with different
        schedules, please input them as different rooms.
      </p>
    </Container>
  );
}

export default function EditSchedule({
  // props come from Rails at the moment
  competitionInfo,
  locale,
}) {
  // initially the saved and unsaved schedule are the same
  const [scheduleWcif, setScheduleWcif] = useState(
    _.cloneDeep(competitionInfo.schedule_wcif),
  );
  const [savedScheduleWcif, setSavedScheduleWcif] = useState(
    _.cloneDeep(competitionInfo.schedule_wcif),
  );

  const [competitionInfoState] = useState({
    id: competitionInfo.id,
    venueDetails: competitionInfo.venue_details,
    countryIso2: competitionInfo.country_iso2,
    countryZones: _.cloneDeep(competitionInfo.country_zones),
    lat: competitionInfo.latitude_degrees,
    lng: competitionInfo.longitude_degrees,
    eventsWcif: _.cloneDeep(competitionInfo.events_wcif),
  });

  const [saving, setSaving] = useState(false);

  const isThereAnyRoom = scheduleWcif.venues
    .some((venue) => venue.rooms.length > 0);
  const [activeTabindex, setActiveTabindex] = useState(isThereAnyRoom ? 1 : 0);

  function unsavedChanges() {
    return !_.isEqual(savedScheduleWcif, scheduleWcif);
  }

  async function save() {
    setSaving(true);
    function onSuccess() {
      setSaving(false);
      setSavedScheduleWcif(
        _.cloneDeep(scheduleWcif),
      );
    }
    function onFailure() {
      setSaving(false);
    }

    await saveWcif(competitionInfoState.id, {
      schedule: scheduleWcif,
    }, onSuccess, onFailure);
  }

  function newVenueId() {
    return (_.max(_.map(scheduleWcif.venues, 'id')) || 0) + 1;
  }

  function addVenue() {
    setScheduleWcif({
      ...scheduleWcif,
      venues: [
        ...scheduleWcif.venues,
        newVenue(competitionInfoState, newVenueId()),
      ],
    });
  }
  function removeVenue(id) {
    const venue = scheduleWcif.venues
      .find((v) => v.id === id);

    if (!window.confirm(`Are you sure you want to remove the venue "${venue.name}" and all the associated rooms and schedules?`)) {
      return;
    }

    setScheduleWcif({
      ...scheduleWcif,
      venues: scheduleWcif.venues
        .filter((v) => v.id !== id),
    });
  }
  function updateVenue(id, venue) {
    setScheduleWcif({
      ...scheduleWcif,
      venues: [
        ...scheduleWcif.venues
          .filter((v) => v.id !== id),
        _.cloneDeep(venue),
      ],
    });
  }

  const unsavedChangesAlert = unsavedChanges() ? (
    <UnsavedChangesAlert
      onClick={save}
      saving={saving}
    />
  ) : null;

  return (
    <Container className="edit-schedule">
      {unsavedChangesAlert}
      <IntroductionMessage />
      <Tab
        activeIndex={activeTabindex}
        onTabChange={(e, { activeIndex }) => setActiveTabindex(activeIndex)}
        panes={[
          {
            menuItem: 'Edit venues information',
            render: () => (
              <>
                <p>Please add all your venues and rooms below:</p>
                <VenuesList
                  venues={scheduleWcif.venues}
                  updateVenue={updateVenue}
                  removeVenue={removeVenue}
                  addVenue={addVenue}
                  competitionInfo={competitionInfoState}
                />
              </>

            ),
          },
          {
            menuItem: 'Edit schedules',
            render: () => (
              <SchedulesEditor
                locale={locale}
              />
            ),
          },
        ]}
      />
      {unsavedChangesAlert}
    </Container>
  );
}
