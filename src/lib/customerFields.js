// Customer fields that must never be sent to a browser, not even the admin's: the password hash and the one-time tokens
// that confirm an email address or reset a password (anyone who read a token could take over that account).
export const CUSTOMER_PRIVATE_FIELDS =
  "-password -verificationToken -verificationTokenExpiry -pendingEmailToken -pendingEmailTokenExpiry -resetPasswordToken -resetPasswordExpires";
