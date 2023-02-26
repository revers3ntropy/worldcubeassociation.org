import React, { useState } from 'react';
import _ from 'lodash';
import {
  Alert, Clearfix, Col, Panel, PanelGroup, Row,
} from 'react-bootstrap';
import cn from 'classnames';
import { roomWcifFromId, saveWcif } from '../lib/utils/wcif';
import SchedulesEditor from './SchedulesEditor';
import EditVenue from './EditVenue';
import {
  defaultDurationFromActivityCode,
  newActivityId,
} from '../lib/utils/edit-schedule';
import {
  calendarHandlers,
  dataToFcEvent, fcEventToActivity,
  momentToIso,
  selectedEventInCalendar,
  singleSelectEvent, singleSelectLastEvent,
} from '../lib/utils/calendar';

export const scheduleElementSelector = '#schedule-calendar';

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

// NOTE: while making this file pretty big, putting these here is the only
// way I found to avoid a circular dependency.
function handleEventModifiedInCalendar(reactElem, event) {
  const room = roomWcifFromId(reactElem.props.scheduleWcif, reactElem.state.selectedRoom);
  const activityIndex = _.findIndex(room.activities, { id: event.id });
  if (activityIndex < 0) {
    throw new Error("This is very very BAD, I couldn't find an activity matching the modified event!");
  }
  const currentActivity = room.activities[activityIndex];
  const updatedActivity = fcEventToActivity(event);
  const activityToMoments = ({ startTime, endTime }) => [
    window.moment(startTime),
    window.moment(endTime),
  ];
  const [currentStart, currentEnd] = activityToMoments(currentActivity);
  const [updatedStart, updatedEnd] = activityToMoments(updatedActivity);
  /* Move and proportionally scale child activities. */
  const lengthRate = updatedEnd.diff(updatedStart) / currentEnd.diff(currentStart);
  updatedActivity.childActivities.forEach((child) => {
    const childActivity = child;
    const [childStart, childEnd] = activityToMoments(childActivity);
    const updatedStartDiff = Math.floor(childStart.diff(currentStart) * lengthRate);
    childActivity.startTime = updatedStart.clone().add(updatedStartDiff, 'ms').utc().format();
    const updatedEndDiff = Math.floor(childEnd.diff(currentStart) * lengthRate);
    childActivity.endTime = updatedStart.clone().add(updatedEndDiff, 'ms').utc().format();
  });
  room.activities[activityIndex] = updatedActivity;
}

function handleRemoveEventFromCalendar(reactElem, event) {
  // eslint-disable-next-line no-alert
  if (!window.confirm(`Are you sure you want to remove ${event.title}`)) {
    return false;
  }

  // Remove activityCode from the list used by the ActivityPicker
  const newActivityCodeList = reactElem.state.usedActivityCodeList;
  const activityCodeIndex = newActivityCodeList.indexOf(event.activityCode);
  if (activityCodeIndex < 0) {
    throw new Error(`No ${event.activityCode} in used activity codes: ${JSON.stringify(newActivityCodeList)}`);
  }
  newActivityCodeList.splice(activityCodeIndex, 1);
  const { scheduleWcif } = reactElem.props;
  // Remove activity from the list used by the ActivityPicker
  const room = roomWcifFromId(scheduleWcif, reactElem.state.selectedRoom);
  _.remove(room.activities, { id: event.id });

  // We rootRender to display the "Please save your changes..." message
  reactElem.setState({ usedActivityCodeList: newActivityCodeList });

  $(scheduleElementSelector).fullCalendar('removeEvents', event.id);
  singleSelectLastEvent(scheduleWcif, reactElem.state.selectedRoom);
  return true;
}

function handleAddActivityToCalendar(reactElem, activityData, renderItOnCalendar) {
  const currentEventSelected = selectedEventInCalendar();
  const roomSelected = roomWcifFromId(reactElem.props.scheduleWcif, reactElem.state.selectedRoom);
  if (roomSelected) {
    const newActivity = {
      id: activityData.id || newActivityId(),
      name: activityData.name,
      activityCode: activityData.activityCode,
      childActivities: [],
    };
    if (activityData.startTime && activityData.endTime) {
      newActivity.startTime = activityData.startTime;
      newActivity.endTime = activityData.endTime;
    } else if (currentEventSelected) {
      const newStart = currentEventSelected.end.clone();
      newActivity.startTime = momentToIso(newStart);
      const newEnd = newStart.add(defaultDurationFromActivityCode(newActivity.activityCode), 'm');
      newActivity.endTime = momentToIso(newEnd);
    } else {
      // Do nothing, user cliked an event without any event selected.
      return;
    }
    roomSelected.activities.push(newActivity);
    if (renderItOnCalendar) {
      const fcEvent = dataToFcEvent(newActivity);
      singleSelectEvent(fcEvent);
      $(scheduleElementSelector).fullCalendar('renderEvent', fcEvent);
    }
    // update list of activityCode used, and rootRender to display the save message
    reactElem.setState({
      usedActivityCodeList: [
        ...reactElem.state.usedActivityCodeList,
        newActivity.activityCode,
      ],
    });
  }
}

function UnsavedChangesAlert({ actionHandler, saving }) {
  return (
    <Alert bsStyle="info">
      You have unsaved changes. Don&rsquo;t forget to
      {' '}
      <button
        type="button"
        onClick={actionHandler}
        disabled={saving}
        className={cn('btn', 'btn-default btn-primary', { saving })}
      >
        save your changes!
      </button>
    </Alert>
  );
}

function IntroductionMessage() {
  return (
    <Col xs={12}>
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
    </Col>
  );
}

/**
 * @param {*[]} venues
 * @param {{
 *     addVenue(e: DomEvent): void,
 *     removeVenue(e: DomEvent, index: number): void,
 *     updateWcif(wcif: *): *
 * }} actionsHandlers
 * @param {*} competitionInfo
 * @returns {JSX.Element}
 * @constructor
 */
function VenuesList({ venues, actionsHandlers, competitionInfo }) {
  return (
    <Row>
      {venues.map((venueWcif, index) => (
        <React.Fragment key={venueWcif.id}>
          <Col xs={12} md={6}>
            <EditVenue
              venueWcif={venueWcif}
              removeVenueAction={(e) => actionsHandlers.removeVenue(e, index)}
              updateWcif={actionsHandlers.updateWcif}
              competitionInfo={{
                ...competitionInfo,
                countryZones: competitionInfo.country_zones,
                venueDetails: competitionInfo.venue_details,
              }}
            />
          </Col>
          {/*
          Every venue col doesn't have the same height, so we need a clearfix
          depending on our index and viewport.
          In XS there is one venue per row, so no clearfix needed.
          In MD there are two venues per row, so if we're last, we need a clearfix.
        */}
          {index % 2 === 1 && <Clearfix visibleMdBlock />}
        </React.Fragment>
      ))}
      <Col xs={12} md={6}>
        <NewVenue actionHandler={actionsHandlers.addVenue} />
      </Col>
    </Row>
  );
}

function NewVenue({ actionHandler }) {
  return (
    <div className="panel-venue">
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
      <a href="#" className="btn btn-success new-venue-link" onClick={actionHandler}>Add a venue</a>
    </div>
  );
}

export default function EditSchedule({
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
    venue: competitionInfo.venue,
    venueDetails: competitionInfo.venue_details,
    countryIso2: competitionInfo.country_iso2,
    countryZones: _.cloneDeep(competitionInfo.country_zones),
    lat: competitionInfo.latitude_degrees,
    lng: competitionInfo.longitude_degrees,
    eventsWcif: _.cloneDeep(competitionInfo.events_wcif),
  });

  const [saving, setSaving] = useState(false);

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

  const actionsHandlers = {
    addVenue(domEvent) {
      domEvent.preventDefault();
      setScheduleWcif({
        ...scheduleWcif,
        venues: [
          ...scheduleWcif.venues,
          newVenue(competitionInfoState, newVenueId()),
        ],
      });
    },
    removeVenue(domEvent, index) {
      domEvent.preventDefault();
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Are you sure you want to remove the venue "${scheduleWcif.venues[index].name}" and all the associated rooms and schedules?`)) {
        return;
      }
      scheduleWcif.venues.splice(index, 1);
      setScheduleWcif(scheduleWcif);
    },
    updateWcif: (wcif) => {
      setScheduleWcif(wcif);
    },
  };

  const isThereAnyRoom = scheduleWcif.venues.some((venue) => venue.rooms.length > 0);

  const unsavedChangesAlert = unsavedChanges() ? (
    <UnsavedChangesAlert
      // eslint-disable-next-line react/jsx-no-bind
      actionHandler={save}
      saving={saving}
    />
  ) : null;

  function setupCalendarHandlers(editor) {
    calendarHandlers.addActivityToCalendar = _.partial(handleAddActivityToCalendar, editor);
    calendarHandlers.eventModifiedInCalendar = _.partial(handleEventModifiedInCalendar, editor);
    calendarHandlers.removeEventFromCalendar = _.partial(handleRemoveEventFromCalendar, editor);
  }

  return (
    <div id="edit-schedule-area">
      {unsavedChangesAlert}
      <Row>
        <IntroductionMessage />
        <Col xs={12}>
          <PanelGroup accordion id="accordion-schedule" defaultActiveKey={isThereAnyRoom ? '2' : '1'}>
            <Panel id="venues-edit-panel" bsStyle="info" eventKey="1">
              <div id="accordion-schedule-heading-1" className="panel-heading heading-as-link" aria-controls="accordion-schedule-body-1" role="button" data-toggle="collapse" data-target="#accordion-schedule-body-1" data-parent="#accordion-schedule">
                <Panel.Title>
                  Edit venues information
                  {' '}
                  <span className="collapse-indicator" />
                </Panel.Title>
              </div>
              <Panel.Body collapsible>
                <Row>
                  <Col xs={12}>
                    <p>Please add all your venues and rooms below:</p>
                  </Col>
                </Row>
                <VenuesList
                  venues={scheduleWcif.venues}
                  actionsHandlers={actionsHandlers}
                  competitionInfo={competitionInfo}
                />
              </Panel.Body>
            </Panel>
            <Panel id="schedules-edit-panel" bsStyle="info" eventKey="2">
              <div
                id="accordion-schedule-heading-2"
                className="panel-heading heading-as-link"
                aria-controls="accordion-schedule-body-2"
                role="button"
                data-toggle="collapse"
                data-target="#accordion-schedule-body-2"
                data-parent="#accordion-schedule"
              >
                <Panel.Title>
                  Edit schedules
                  {' '}
                  <span className="collapse-indicator" />
                </Panel.Title>
              </div>
              <Panel.Body id="schedules-edit-panel-body" collapsible>
                <SchedulesEditor
                  scheduleWcif={scheduleWcif}
                  eventsWcif={competitionInfo.events_wcif}
                  locale={locale}
                  // eslint-disable-next-line react/jsx-no-bind
                  setupCalendarHandlers={setupCalendarHandlers}
                />
              </Panel.Body>
            </Panel>
          </PanelGroup>
        </Col>
      </Row>
      {unsavedChangesAlert}
    </div>
  );
}
