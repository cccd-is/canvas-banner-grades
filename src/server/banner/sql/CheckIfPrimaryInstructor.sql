select distinct sirasgn_crn from sirasgn, spriden where sirasgn_term_code = :term  and sirasgn_primary_ind = 'Y' and  spriden_id = :cNumber and spriden_change_ind is 
null and sirasgn_pidm = spriden_pidm

