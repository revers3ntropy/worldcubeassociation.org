import _ from 'lodash';

function withNestedActivities(activities) {
  if (activities.length === 0) return [];
  return [
    ...activities,
    ...withNestedActivities(_.flatMap(activities, 'childActivities')),
  ];
}

export function convertVenueActivitiesToVenueTimezone(oldTZ, venueWcif) {
  // Called when a venue's timezone has been updated, to update all the activities times.
  // The WCA website expose times in UTC, so we need to do two steps:
  //   - first, express each activity times in the old venue's timezone
  //   - second, change the timezone without changing the actual time figure
  //   (eg: 4pm stays 4pm, but in a different timezone).
  const newTZ = venueWcif.timezone;
  venueWcif.rooms.forEach((room) => {
    withNestedActivities(room.activities).forEach((activity) => {
      // Undocumented "keepTime" parameter, see here:
      // https://stackoverflow.com/questions/28593304/same-date-in-different-time-zone/28615654#28615654
      // This enables us to change the UTC offset without changing
      // the *actual* time of the activity!
      // NOTE: we intentionally modify the object referenced by activity.
      /* eslint-disable-next-line */
      activity.startTime = window.moment(activity.startTime)
        .tz(oldTZ)
        .tz(newTZ, true)
        .format();
      /* eslint-disable-next-line */
      activity.endTime = window.moment(activity.endTime)
        .tz(oldTZ)
        .tz(newTZ, true)
        .format();
    });
  });
}
