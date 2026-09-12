class AppRoutes {
  //EVENTS
  static const eventDetail = '/event-detail';
  static const eventList = '/event-list';
  static const favoritesEvents = '/favorites-events';

  //PLACES
  static const favoritesPlaces = '/favorites-places';
  static const placeDetail = '/place-detail';
  static const hotPlaces = '/hot-places';
  static const placeReviews = '/place-reviews';

  //HOME
  static const home = '/home';
  static const initialScreen = '/initial';

  //ONBOARDING
  // As tres telas vivem dentro de uma rota so (PageView), entao existe
  // apenas um nome aqui.
  static const onboarding = '/onboarding';

  //REGISTER
  static const emailConfirm = '/email-confirm';
  static const login = '/login';
  static const recoverPassword = '/recover-password';
  static const register = '/register';
  static const resetPassword = '/reset-password';

  //SEARCH
  static const search = '/search';

  //SETTINGS
  static const accountManagementSettings = '/account-management-settings';
  static const settings = '/settings';
  static const personalInformationSettings = '/personal-information-settings';

  //USER
  static const profile = '/profile';
  static const profileEditing = '/profile-edit';
  static const userInterests = '/user-interests';
  static const otherProfile = '/other-profile';

  //FEED
  static const feed = '/feed';
  static const newPublication = '/new-publication';
  static const postDetail = '/post-detail';
}