// What the public storefront may see of a review or a product question. The database documents also hold the
// author's email address, IP address, browser string, spam score, vote fingerprints and internal ids; those were
// being sent to every visitor. Everything is listed explicitly here, so a field added to the model later stays private
// until someone decides to publish it.

const sameEmail = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** Does the signed-in viewer own this review? (Decided on the server, so the author's email never has to be sent.) */
export function viewerOwnsReview(review, viewer) {
  if (!viewer?.id) return false;
  return (!!review.customerId && String(review.customerId) === String(viewer.id)) || sameEmail(review.customerEmail, viewer.email);
}

export function toPublicReview(review, viewer = null) {
  return {
    _id: review._id,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    customerName: review.customerName,
    verifiedPurchase: review.verifiedPurchase,
    recommend: review.recommend,
    helpfulVotes: review.helpfulVotes,
    unhelpfulVotes: review.unhelpfulVotes,
    isFeatured: review.isFeatured,
    media: (review.media || []).map((m) => ({ url: m.url, type: m.type })),
    replies: (review.replies || []).map((r) => ({ _id: r._id, staffName: r.staffName, comment: r.comment, createdAt: r.createdAt })),
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    isOwner: viewerOwnsReview(review, viewer),
  };
}

export function toPublicQuestion(question) {
  return {
    _id: question._id,
    question: question.question,
    replies: (question.replies || []).map((r) => ({ _id: r._id, staffName: r.staffName, answer: r.answer, createdAt: r.createdAt })),
    createdAt: question.createdAt,
  };
}
