# Viva Questions
1. **Why JWT?** Stateless auth; the token carries id and role, verified by middleware on every request.
2. **How do you stop students from applying when ineligible?** The backend re-runs `checkEligibility` on apply; the UI button is only a convenience.
3. **How are duplicate applications prevented?** A UNIQUE(student_id, drive_id) key in MySQL plus a 409 response.
4. **Is the recommendation machine learning?** No. It is a weighted rule score (20/20/15/15/30) that is fully explainable.
5. **How do you avoid SQL injection?** Parameterised queries (`?` placeholders) everywhere.
6. **How are passwords stored?** bcrypt hashes; never returned by any API.
7. **How is the admin created?** Only via the seed script, not public registration.
8. **How is a resume protected?** Random file names, PDF header validation, 2 MB limit, and access only for the owner, admin or a recruiter with that applicant.
9. **What is "placed" in analytics?** Distinct students with at least one selected application, so nobody is double-counted.
10. **What does the readiness score mean?** A rule-based indicator, not a prediction of placement.
11. **What is CSV formula injection?** Cells starting with = + - @ run as formulas in Excel; we prefix them with an apostrophe.
12. **What are the limits of the resume analyzer?** Only file checks; text extraction is not implemented.
